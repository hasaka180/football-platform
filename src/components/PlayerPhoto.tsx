import type { PlayerPhoto as Photo } from '@/lib/data'

/**
 * A player's photo, or initials when no freely licensed photo exists.
 * Photos come from Wikimedia Commons under CC BY / BY-SA / CC0 / public domain;
 * `Credit` renders the attribution those licences require.
 */
export default function PlayerPhoto({ name, photo, size = 64, rounded = 'rounded-2xl', ring }: {
  name: string
  photo: Photo | null
  size?: number
  rounded?: string
  ring?: string
}) {
  const style = { width: size, height: size }
  if (!photo) {
    return (
      <span aria-hidden="true" style={style} className={`grid shrink-0 place-items-center border border-line bg-surface-2 font-semibold text-muted ${rounded} ${ring ?? ''}`}>
        <span style={{ fontSize: size * 0.32 }}>{name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- already a sized Commons thumbnail; no optimiser needed
    <img src={photo.url} alt={`${name}`} width={size} height={size} loading="lazy" decoding="async" style={style}
      className={`shrink-0 border border-line object-cover object-top ${rounded} ${ring ?? ''}`} />
  )
}

/** Attribution line: author, licence (linked) and the Commons file page. */
export function Credit({ photo, className = '' }: { photo: Photo | null; className?: string }) {
  if (!photo) return null
  return (
    <p className={`text-[11px] leading-snug text-faint ${className}`}>
      Photo: <a href={photo.pageUrl} className="underline-offset-2 hover:text-text hover:underline" rel="noopener" target="_blank">{photo.artist}</a>,{' '}
      {photo.licenceUrl ? <a href={photo.licenceUrl} className="underline-offset-2 hover:text-text hover:underline" rel="noopener license" target="_blank">{photo.licence}</a> : photo.licence}, via Wikimedia Commons
    </p>
  )
}
