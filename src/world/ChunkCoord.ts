export class ChunkCoord {
  public constructor(
    public readonly x: number,
    public readonly z: number,
  ) {}

  public get key(): string {
    return ChunkCoord.toKey(this.x, this.z)
  }

  public distanceTo(other: ChunkCoord): number {
    return Math.max(Math.abs(this.x - other.x), Math.abs(this.z - other.z))
  }

  public static fromWorldPosition(x: number, z: number, chunkSizeMeters: number): ChunkCoord {
    return new ChunkCoord(Math.floor(x / chunkSizeMeters), Math.floor(z / chunkSizeMeters))
  }

  public static toKey(x: number, z: number): string {
    return `chunk_${x}_${z}`
  }
}
