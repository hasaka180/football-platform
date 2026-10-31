-- Freely licensed player photos with the attribution each licence requires.
-- Only Wikimedia Commons files under CC BY, CC BY-SA, CC0 or public domain
-- are stored (docs/LICENSING.md); everything needed to credit the author
-- travels with the image.

INSERT INTO data_sources (code, name, licence, attribution, url, is_production) VALUES
  ('wikimedia-commons', 'Wikimedia Commons', 'Per-file Creative Commons or public domain', 'Photos credited individually', 'https://commons.wikimedia.org', true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE player_media (
  player_id     uuid PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  source_code   text NOT NULL REFERENCES data_sources(code),
  wikidata_id   text NOT NULL,            -- the person the photo depicts
  file_title    text NOT NULL,            -- "File:…" on Commons
  page_url      text NOT NULL,            -- Commons file page (attribution link)
  thumb_url     text NOT NULL,
  thumb_width   integer NOT NULL,
  thumb_height  integer NOT NULL,
  licence       text NOT NULL,            -- e.g. "CC BY-SA 4.0"
  licence_url   text,
  artist        text NOT NULL,            -- plain text, from the file's metadata
  retrieved_at  timestamptz NOT NULL
);
