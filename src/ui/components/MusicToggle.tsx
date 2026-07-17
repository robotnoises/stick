export interface MusicToggleProps {
  readonly enabled: boolean
  readonly onToggle: () => void
}

export function MusicToggle({ enabled, onToggle }: MusicToggleProps) {
  return (
    <button
      aria-label={enabled ? "Turn music off" : "Turn music on"}
      className="stick-music-toggle"
      onClick={onToggle}
      title={enabled ? "Music on" : "Music off"}
      type="button"
    >
      <span
        aria-hidden="true"
        className={enabled ? "stick-music-toggle-icon-on" : "stick-music-toggle-icon-off"}
      />
    </button>
  )
}
