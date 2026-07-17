export interface MusicTrack {
  readonly id: string
  readonly name: string
  readonly url: string
}

const musicModules = import.meta.glob("../../assets/sounds/music/*.{mp3,wav,ogg}", {
  eager: true,
  query: "?url",
  import: "default",
})

export function getMusicTracks(): readonly MusicTrack[] {
  return Object.entries(musicModules)
    .map(([path, url]) => ({
      id: path,
      name: getTrackName(path),
      url: String(url),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function getTrackName(path: string): string {
  const fileName = path.split("/").pop() ?? path
  const nameWithoutExtension = fileName.replace(/\.[^.]+$/, "")

  return nameWithoutExtension
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
