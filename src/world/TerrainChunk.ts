import { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { EngineContext } from "../app/EngineContext"
import type { ChunkTerrainData, GeneratedPropData } from "./TerrainTypes"
import type { WorldFeatureGenerator } from "./generation/WorldFeatureGenerator"
import { DeadPinePropBuilder } from "./props/deadPine/DeadPinePropBuilder"
import { GroundLitterBuilder } from "./props/groundLitter/GroundLitterBuilder"
import { LogPropBuilder } from "./props/log/LogPropBuilder"
import { PinePropBuilder } from "./props/pine/PinePropBuilder"
import { RockPropBuilder } from "./props/rock/RockPropBuilder"
import { ChunkHeightSampler } from "./terrain/ChunkHeightSampler"
import { TerrainMeshBuilder } from "./terrain/TerrainMeshBuilder"
import type { TerrainChunkMaterials } from "./terrain/TerrainChunkMaterials"
import { WaterMeshBuilder } from "./water/WaterMeshBuilder"

export type { TerrainChunkMaterials } from "./terrain/TerrainChunkMaterials"

export class TerrainChunk {
  private readonly _heightSampler: ChunkHeightSampler
  private readonly _terrainMesh: Mesh
  private readonly _props: Mesh[] = []

  public constructor(
    private readonly _context: EngineContext,
    private readonly _data: ChunkTerrainData,
    private readonly _materials: TerrainChunkMaterials,
    private readonly _worldFeatures: WorldFeatureGenerator | null = null,
  ) {
    this._heightSampler = new ChunkHeightSampler(this._data)
    this._terrainMesh = this._createTerrainMesh()
    this._props.push(...this._createWaterMeshes())

    for (const prop of this._data.props) {
      this._createProp(prop)
    }

    this._createGroundLitterMesh()
  }

  public get key(): string {
    return this._data.key
  }

  public dispose(): void {
    for (const prop of this._props) {
      prop.dispose()
    }

    this._props.length = 0
    this._terrainMesh.dispose()
  }

  private _createTerrainMesh(): Mesh {
    return new TerrainMeshBuilder(this._context, this._data, this._materials).create()
  }

  private _createWaterMeshes(): Mesh[] {
    return new WaterMeshBuilder(this._context, this._data, this._materials, this._worldFeatures).create()
  }

  public _sampleChunkHeight(worldX: number, worldZ: number): number {
    return this._heightSampler.sample(worldX, worldZ)
  }

  private _createProp(prop: GeneratedPropData): void {
    switch (prop.type) {
      case "pine":
        this._createPineProp(prop)
        return
      case "deadPine":
        this._createDeadPineProp(prop)
        return
      case "rock":
        this._createRockProp(prop)
        return
      case "log":
        this._createLogProp(prop)
        return
    }
  }

  private _createPineProp(prop: GeneratedPropData): void {
    this._props.push(...new PinePropBuilder(this._context, this._materials).create(prop))
  }

  private _createGroundLitterMesh(): void {
    const mesh = new GroundLitterBuilder(this._context, this._data, this._materials).create()

    if (mesh) {
      this._props.push(mesh)
    }
  }

  private _createDeadPineProp(prop: GeneratedPropData): void {
    this._props.push(...new DeadPinePropBuilder(this._context, this._materials).create(prop))
  }

  private _createRockProp(prop: GeneratedPropData): void {
    this._props.push(new RockPropBuilder(this._context, this._materials).create(prop))
  }

  private _createLogProp(prop: GeneratedPropData): void {
    this._props.push(...new LogPropBuilder(this._context, this._materials).create(prop))
  }
}
