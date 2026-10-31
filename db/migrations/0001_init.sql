-- Core schema for the MVP. Runs on Supabase Postgres and on PGlite.
-- Tables for users, editorial and transfers arrive with the phases that need
-- them (see docs/DATABASE.md).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Provenance ───────────────────────────────────────────────────────────────

CREATE TABLE data_sources (
  code         text PRIMARY KEY,                -- matches docs/LICENSING.md
  name         text NOT NULL,
  licence      text NOT NULL,
  attribution  text,                            -- text to display, when required
  url          text,
  is_production boolean NOT NULL DEFAULT true   -- false for dev fixtures
);

-- ── Competitions and seasons ────────────────────────────────────────────────

CREATE TABLE competitions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  short_name  text NOT NULL,
  country     text,
  kind        text NOT NULL CHECK (kind IN ('league', 'cup'))
);

CREATE TABLE seasons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,              -- '2025-26'
  name       text NOT NULL,                     -- '2025/26'
  starts_on  date,
  ends_on    date
);

CREATE TABLE competition_seasons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  uuid NOT NULL REFERENCES competitions(id),
  season_id       uuid NOT NULL REFERENCES seasons(id),
  source_code     text NOT NULL REFERENCES data_sources(code),
  retrieved_at    timestamptz,                  -- last successful ingest
  source_updated_at timestamptz,                -- when the source itself last changed
  UNIQUE (competition_id, season_id)
);

-- ── Clubs and players ───────────────────────────────────────────────────────

CREATE TABLE clubs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  short_name  text,
  country     text
);

CREATE TABLE club_aliases (
  club_id     uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  alias       text NOT NULL,
  normalized  text NOT NULL,
  PRIMARY KEY (club_id, normalized)
);

CREATE TABLE players (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,                -- display name
  normalized_name  text NOT NULL
);

CREATE TABLE player_aliases (
  player_id    uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  alias        text NOT NULL,
  normalized   text NOT NULL,
  source_code  text REFERENCES data_sources(code),
  PRIMARY KEY (player_id, normalized)
);

CREATE TABLE player_club_memberships (
  player_id              uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  club_id                uuid NOT NULL REFERENCES clubs(id),
  competition_season_id  uuid NOT NULL REFERENCES competition_seasons(id),
  first_match_on         date,
  last_match_on          date,
  PRIMARY KEY (player_id, club_id, competition_season_id)
);

-- Provider identifiers never leak into the UI; they resolve to internal IDs here.
CREATE TABLE provider_entity_mappings (
  source_code   text NOT NULL REFERENCES data_sources(code),
  entity_type   text NOT NULL CHECK (entity_type IN ('competition', 'club', 'player', 'match')),
  provider_key  text NOT NULL,
  entity_id     uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_code, entity_type, provider_key)
);

-- ── Matches ─────────────────────────────────────────────────────────────────

CREATE TABLE matches (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   text NOT NULL UNIQUE,
  competition_season_id  uuid NOT NULL REFERENCES competition_seasons(id),
  round                  text,
  kickoff_on             date NOT NULL,          -- always known
  kickoff_at             timestamptz,            -- null when the time is unknown
  home_club_id           uuid NOT NULL REFERENCES clubs(id),
  away_club_id           uuid NOT NULL REFERENCES clubs(id),
  status                 text NOT NULL CHECK (status IN (
                           'scheduled', 'pre_match', 'live', 'halftime', 'extra_time', 'penalties',
                           'suspended', 'postponed', 'abandoned', 'finished', 'cancelled')),
  home_score             smallint,               -- null = not available, never 0 by default
  away_score             smallint,
  home_score_ht          smallint,
  away_score_ht          smallint,
  went_to_extra_time     boolean,
  home_penalties         smallint,
  away_penalties         smallint,
  venue                  text,
  attendance             integer,
  referee                text,
  has_lineups            boolean NOT NULL DEFAULT false,
  source_code            text NOT NULL REFERENCES data_sources(code),
  retrieved_at           timestamptz NOT NULL,
  data_version           integer NOT NULL DEFAULT 1,
  CHECK (home_club_id <> away_club_id)
);
CREATE INDEX matches_cs_kickoff ON matches (competition_season_id, kickoff_on);
CREATE INDEX matches_home ON matches (home_club_id, kickoff_on);
CREATE INDEX matches_away ON matches (away_club_id, kickoff_on);

CREATE TABLE match_lineups (
  match_id    uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL REFERENCES players(id),
  club_id     uuid NOT NULL REFERENCES clubs(id),
  role        text NOT NULL CHECK (role IN ('starter', 'bench')),
  is_captain  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (match_id, player_id)
);
CREATE INDEX match_lineups_player ON match_lineups (player_id);

CREATE TABLE match_events (
  match_id           uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  seq                smallint NOT NULL,          -- order within the match
  club_id            uuid NOT NULL REFERENCES clubs(id),  -- the side the event counts for
  type               text NOT NULL CHECK (type IN (
                       'goal', 'penalty_goal', 'own_goal', 'yellow_card', 'second_yellow',
                       'red_card', 'substitution')),
  minute             smallint NOT NULL,
  added_minute       smallint,
  player_id          uuid REFERENCES players(id),  -- null when unresolved
  player_name        text,                          -- as published, for unresolved events
  related_player_id  uuid REFERENCES players(id),  -- substitution: the player coming off
  PRIMARY KEY (match_id, seq)
);
CREATE INDEX match_events_player ON match_events (player_id);

-- ── Derived tables (rebuilt by ingestion) ───────────────────────────────────

CREATE TABLE player_match_statistics (
  match_id     uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id    uuid NOT NULL REFERENCES players(id),
  club_id      uuid NOT NULL REFERENCES clubs(id),
  started      boolean NOT NULL,
  minute_on    smallint NOT NULL,
  minute_off   smallint NOT NULL,
  minutes      smallint NOT NULL,               -- derived; see docs/DECISIONS.md D-003
  goals        smallint NOT NULL DEFAULT 0,
  penalty_goals smallint NOT NULL DEFAULT 0,
  own_goals    smallint NOT NULL DEFAULT 0,
  yellow_cards smallint NOT NULL DEFAULT 0,
  red_cards    smallint NOT NULL DEFAULT 0,     -- straight reds and second yellows
  PRIMARY KEY (match_id, player_id)
);
CREATE INDEX pms_player ON player_match_statistics (player_id);

CREATE TABLE player_season_statistics (
  player_id              uuid NOT NULL REFERENCES players(id),
  club_id                uuid NOT NULL REFERENCES clubs(id),
  competition_season_id  uuid NOT NULL REFERENCES competition_seasons(id),
  appearances            smallint NOT NULL,
  starts                 smallint NOT NULL,
  sub_appearances        smallint NOT NULL,
  unused_sub             smallint NOT NULL,
  minutes                integer NOT NULL,
  goals                  smallint NOT NULL,
  penalty_goals          smallint NOT NULL,
  own_goals              smallint NOT NULL,
  yellow_cards           smallint NOT NULL,
  red_cards              smallint NOT NULL,
  computed_at            timestamptz NOT NULL,
  PRIMARY KEY (player_id, club_id, competition_season_id)
);
CREATE INDEX pss_cs_goals ON player_season_statistics (competition_season_id, goals DESC);

CREATE TABLE standings (
  competition_season_id  uuid NOT NULL REFERENCES competition_seasons(id),
  club_id                uuid NOT NULL REFERENCES clubs(id),
  position               smallint NOT NULL,
  played                 smallint NOT NULL,
  won                    smallint NOT NULL,
  drawn                  smallint NOT NULL,
  lost                   smallint NOT NULL,
  goals_for              smallint NOT NULL,
  goals_against          smallint NOT NULL,
  points                 smallint NOT NULL,
  method                 text NOT NULL CHECK (method IN ('computed', 'provider')),
  source_code            text NOT NULL REFERENCES data_sources(code),
  as_of                  timestamptz NOT NULL,
  PRIMARY KEY (competition_season_id, club_id)
);

-- ── Ingestion and governance ────────────────────────────────────────────────

CREATE TABLE ingestion_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code  text NOT NULL REFERENCES data_sources(code),
  kind         text NOT NULL,                   -- e.g. 'competition-season'
  target       text NOT NULL,                   -- e.g. 'premier-league/2025-26'
  status       text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  summary      jsonb,
  error        text
);

CREATE TABLE ingestion_failures (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  entity_ref  text NOT NULL,
  reason      text NOT NULL,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE data_corrections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid REFERENCES ingestion_jobs(id),
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  field        text NOT NULL,
  old_value    jsonb,
  new_value    jsonb,
  detected_at  timestamptz NOT NULL DEFAULT now()
);

-- Request budget per provider and UTC day (free quotas).
CREATE TABLE api_usage (
  source_code  text NOT NULL REFERENCES data_sources(code),
  day          date NOT NULL,
  requests     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (source_code, day)
);

CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor        text NOT NULL,
  action       text NOT NULL,
  entity_type  text,
  entity_id    uuid,
  detail       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Search ──────────────────────────────────────────────────────────────────

CREATE INDEX players_name_trgm ON players USING gin (normalized_name gin_trgm_ops);
CREATE INDEX player_aliases_trgm ON player_aliases USING gin (normalized gin_trgm_ops);
CREATE INDEX club_aliases_trgm ON club_aliases USING gin (normalized gin_trgm_ops);

INSERT INTO data_sources (code, name, licence, attribution, url, is_production) VALUES
  ('openfootball', 'openfootball', 'CC0 1.0', 'Match data: openfootball (CC0)', 'https://github.com/openfootball', true),
  ('football-data', 'football-data.org', 'football-data.org Terms & Conditions (free tier)', 'Football data provided by the Football-Data.org API', 'https://www.football-data.org', true),
  ('dev-fixtures', 'Development fixtures', 'Internal, tests only', NULL, NULL, false);
