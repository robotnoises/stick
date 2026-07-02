import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { defaultGameConfig } from "../src/app/GameConfig"
import { EngineContext } from "../src/app/EngineContext"
import { loadGameSettings, saveGameSettings } from "../src/app/GameSettings"
import { DebugOverlay } from "../src/debug/DebugOverlay"
import { BabylonBootstrap } from "../src/engine/BabylonBootstrap"
import { LightingController } from "../src/environment/LightingController"
import { TimeOfDaySystem } from "../src/environment/TimeOfDaySystem"
import { Compass } from "../src/player/Compass"
import { PlayerController } from "../src/player/PlayerController"
import { ChunkCoord } from "../src/world/ChunkCoord"
import { ChunkManager } from "../src/world/ChunkManager"
import { ProgressiveTerrainSystem } from "../src/world/ProgressiveTerrainSystem"
import { TerrainChunk } from "../src/world/TerrainChunk"
import type { ChunkTerrainData } from "../src/world/TerrainTypes"
import { TerrainGenerator } from "../src/world/generation/TerrainGenerator"
import { LocalForageChunkRepository } from "../src/data/LocalForageChunkRepository"
import type { ChunkRepository, PersistedChunkData } from "../src/data/ChunkRepository"
import { TestTerrainSystem } from "../src/world/TestTerrainSystem"

const FakeColor3 = (globalThis as any).FakeColor3
const FakeColor4 = (globalThis as any).FakeColor4
const FakeVector3 = (globalThis as any).FakeVector3
const FakeEngine = (globalThis as any).FakeEngine
const FakeScene = (globalThis as any).FakeScene
const FakeWebGPUEngine = (globalThis as any).FakeWebGPUEngine

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(document, "pointerLockElement", {
    configurable: true,
    get: () => null,
  })
  document.body.innerHTML = ""
  window.localStorage.clear()
})

function createContext(): EngineContext {
  const canvas = document.createElement("canvas")
  const engine = new FakeEngine(canvas)
  const scene = new FakeScene(engine)

  return new EngineContext(canvas, engine, scene, defaultGameConfig)
}

function createSmallChunkData(): ChunkTerrainData {
  return {
    key: "chunk_0_0",
    coord: new ChunkCoord(0, 0),
    chunkSizeMeters: 2,
    resolution: 1,
    generatorVersion: 1,
    seed: 1337,
    heights: new Float32Array([0, 1, 2, 3]),
    props: [
      {
        id: "pine-1",
        type: "pine",
        position: [0.5, 1, 0.5],
        rotationY: 0.5,
        scale: 1,
      },
      {
        id: "rock-1",
        type: "rock",
        position: [1, 0, 1],
        rotationY: 0,
        scale: 1,
      },
    ],
  }
}

describe("app settings and engine primitives", () => {
  it("stores and loads settings with defaults and invalid data fallback", () => {
    expect(loadGameSettings()).toEqual({ invertMouseY: false })

    saveGameSettings({ invertMouseY: true })
    expect(loadGameSettings()).toEqual({ invertMouseY: true })

    window.localStorage.setItem("stick.settings", JSON.stringify({}))
    expect(loadGameSettings()).toEqual({ invertMouseY: false })

    window.localStorage.setItem("stick.settings", "not-json")
    expect(loadGameSettings()).toEqual({ invertMouseY: false })
  })

  it("creates the appropriate Babylon engine and scene", async () => {
    const canvas = document.createElement("canvas")

    FakeWebGPUEngine.IsSupportedAsync = Promise.resolve(false)
    const fallbackEngine = await BabylonBootstrap.createEngine(canvas)
    expect(fallbackEngine).toBeInstanceOf(FakeEngine)

    FakeWebGPUEngine.IsSupportedAsync = Promise.resolve(true)
    const webgpuEngine = await BabylonBootstrap.createEngine(canvas)
    expect(webgpuEngine).toBeInstanceOf(FakeWebGPUEngine)
    expect((webgpuEngine as InstanceType<typeof FakeWebGPUEngine>).initialized).toBe(true)

    const scene = BabylonBootstrap.createScene(webgpuEngine)
    expect(scene.clearColor).toEqual(new FakeColor4(0.53, 0.72, 0.9, 1))
  })

  it("stores engine context dependencies", () => {
    const context = createContext()

    expect(context.canvas).toBeInstanceOf(HTMLCanvasElement)
    expect(context.config).toBe(defaultGameConfig)
  })
})

describe("player, compass, debug overlay, and time", () => {
  it("advances time and wraps after 24 hours", () => {
    const time = new TimeOfDaySystem(23.5, 3600)

    time.update(1)
    expect(time.elapsedWorldSeconds).toBe(3600)
    expect(time.timeOfDayHours).toBeCloseTo(0.5)
  })

  it("computes compass heading from camera forward direction", () => {
    const camera = {
      getForwardRay: () => ({ direction: new FakeVector3(1, 0, 0) }),
    }

    expect(new Compass(camera as any).getHeadingDegrees()).toBeCloseTo(90)
  })

  it("configures player controls and follows terrain height", () => {
    const context = createContext()
    const requestPointerLock = vi.fn()

    context.canvas.requestPointerLock = requestPointerLock

    const player = new PlayerController(context)

    expect((context.scene.activeCamera as unknown as { speed: number }).speed).toBe(0.25)

    context.canvas.click()
    expect(requestPointerLock).toHaveBeenCalledOnce()

    Object.defineProperty(document, "pointerLockElement", {
      configurable: true,
      get: () => context.canvas,
    })
    context.canvas.click()
    expect(requestPointerLock).toHaveBeenCalledOnce()

    player.update(0.016)
    expect(player.position.y).toBe(1.7)

    player.setInvertMouseY(true)
    player.setGroundHeightProvider((x, z) => x + z)
    player.update(0.016)

    expect(player.position.y).toBeCloseTo(player.position.x + player.position.z + 1.7)
    expect(player.headingDegrees).toBe(0)
    expect(context.scene.activeCamera).toBeTruthy()

    player.dispose()
    context.canvas.click()
    expect(requestPointerLock).toHaveBeenCalledOnce()
  })

  it("renders and removes debug overlay", () => {
    const player = {
      position: new FakeVector3(1.23, 4.56, 7.89),
      headingDegrees: 123,
    }
    const time = { timeOfDayHours: 8.5 }
    const overlay = new DebugOverlay(player as any, time as any)

    overlay.update(0.016)
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("elevation: 2.9m")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("heading: 123°")

    overlay.dispose()
    expect(document.querySelector("#debug-overlay")).toBeNull()
  })
})

describe("lighting", () => {
  it("updates sun, moon, sky, and disposes resources", () => {
    const context = createContext()
    const time = new TimeOfDaySystem(6, 1)
    const lighting = new LightingController(context, time)

    context.scene.activeCamera = {
      position: new FakeVector3(10, 20, 30),
    } as typeof context.scene.activeCamera
    lighting.update(0.016)
    expect(context.scene.clearColor.r).toBeGreaterThan(0)
    expect(context.scene.fogColor.r).toBe(context.scene.clearColor.r)
    expect(context.scene.fogMode).toBe(FakeScene.FOGMODE_LINEAR)
    expect(context.scene.fogStart).toBe(90)
    expect(context.scene.fogEnd).toBe(260)

    context.scene.activeCamera = null
    lighting.update(0.016)

    lighting.dispose()
  })
})

describe("chunk coordinates and generation", () => {
  it("converts world positions to stable chunk coordinates", () => {
    const coord = ChunkCoord.fromWorldPosition(-1, 65, 64)

    expect(coord.x).toBe(-1)
    expect(coord.z).toBe(1)
    expect(coord.key).toBe("chunk_-1_1")
    expect(coord.distanceTo(new ChunkCoord(1, 3))).toBe(2)
    expect(ChunkCoord.toKey(2, -3)).toBe("chunk_2_-3")
  })

  it("generates deterministic terrain data and props", () => {
    const generator = new TerrainGenerator({ seed: 7, chunkSizeMeters: 64, resolution: 4 })
    const a = generator.generateChunk(new ChunkCoord(2, 3))
    const b = generator.generateChunk(new ChunkCoord(2, 3))

    expect(a.key).toBe("chunk_2_3")
    expect(a.heights.length).toBe(25)
    expect([...a.heights]).toEqual([...b.heights])
    expect(a.props.length).toBeGreaterThan(0)
    expect(generator.getHeight(1.5, 2.5)).toBe(generator.getHeight(1.5, 2.5))
  })

  it("builds and disposes terrain chunk meshes and supported props", () => {
    const context = createContext()
    const material = {
      terrain: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as any,
      trunk: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as any,
      needles: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as any,
    }
    const chunk = new TerrainChunk(context, createSmallChunkData(), material)
    const sparseChunk = new TerrainChunk(
      context,
      { ...createSmallChunkData(), key: "chunk_sparse", heights: new Float32Array([0]) },
      material,
    )

    expect(chunk.key).toBe("chunk_0_0")
    chunk.dispose()
    sparseChunk.dispose()
  })
})

describe("data repositories", () => {
  it("saves, lists, loads, and deletes chunks through localForage", async () => {
    const repository = new LocalForageChunkRepository()
    const chunk = createPersistedChunk("chunk_repo")

    await repository.saveChunk(chunk)
    expect(await repository.listChunkKeys()).toContain("chunk_repo")
    expect(await repository.getChunk("chunk_repo")).toEqual(chunk)

    await repository.deleteChunk("chunk_repo")
    expect(await repository.getChunk("chunk_repo")).toBeNull()
  })
})

describe("chunk manager", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  it("generates, caches, samples, disposes, and evicts chunks", async () => {
    const context = createContext()
    const repository = new MemoryChunkRepository()
    const generator = new TerrainGenerator({ seed: 1337, chunkSizeMeters: 8, resolution: 2 })
    const manager = new ChunkManager(context, generator, repository, {
      loadRadiusChunks: 0,
      unloadRadiusChunks: 0,
      memoryRadiusChunks: 0,
    })

    await manager.updateAround(new ChunkCoord(0, 0))
    await manager.updateAround(new ChunkCoord(0, 0))
    expect(repository.savedKeys).toContain("chunk_0_0")
    expect(manager.getHeightAt(1, 1)).toBeTypeOf("number")

    ;(manager as any)._activeChunks.clear()
    await manager.updateAround(new ChunkCoord(0, 0))
    expect(
      (manager as any)._sampleChunkHeight(
        { ...createSmallChunkData(), heights: new Float32Array([]) },
        1,
        1,
      ),
    ).toBe(0)
    ;(manager as any)._activeChunks.clear()
    ;(manager as any)._evictDistantCachedData(new ChunkCoord(0, 0))

    ;(manager as any)._activeCoords.delete("chunk_0_0")
    await manager.updateAround(new ChunkCoord(1, 0))
    await manager.updateAround(new ChunkCoord(0, 0))
    expect(manager.getHeightAt(1000, 1000)).toBeTypeOf("number")

    manager.dispose()
  })

  it("loads compatible persisted chunks and applies mutations", async () => {
    const context = createContext()
    const repository = new MemoryChunkRepository()
    repository.items.set(
      "chunk_0_0",
      createPersistedChunk("chunk_0_0", {
        mutations: [
          { type: "terrainDelta", vertexIndex: 0, deltaY: 5 },
          { type: "propRemoved", propId: "remove-me" },
        ],
        props: [
          {
            id: "remove-me",
            type: "pine",
            position: [0, 0, 0],
            rotationY: 0,
            scale: 1,
          },
        ],
      }),
    )
    const generator = new TerrainGenerator({ seed: 1337, chunkSizeMeters: 8, resolution: 2 })
    const manager = new ChunkManager(context, generator, repository, {
      loadRadiusChunks: 0,
      unloadRadiusChunks: 1,
      memoryRadiusChunks: 1,
    })

    await manager.updateAround(new ChunkCoord(0, 0))
    expect(repository.items.get("chunk_0_0")?.lastVisitedAt).toBeGreaterThan(0)
    expect(
      (manager as any)._fromPersistedChunk(
        createPersistedChunk("chunk_sparse_mutation", {
          mutations: [{ type: "terrainDelta", vertexIndex: 99, deltaY: 2 }],
        }),
      ).heights[99],
    ).toBeUndefined()

    manager.dispose()
  })

  it("regenerates incompatible chunks and tolerates repository failures", async () => {
    const context = createContext()
    const repository = new MemoryChunkRepository()
    repository.items.set("chunk_0_0", createPersistedChunk("chunk_0_0", { worldSeed: 999 }))
    repository.failLoad = true
    repository.failSave = true

    const generator = new TerrainGenerator({ seed: 1337, chunkSizeMeters: 8, resolution: 2 })
    const manager = new ChunkManager(context, generator, repository, {
      loadRadiusChunks: 0,
      unloadRadiusChunks: 1,
      memoryRadiusChunks: 1,
    })

    expect(
      (manager as any)._isCompatiblePersistedChunk(
        createPersistedChunk("chunk_wrong_size", { chunkSizeMeters: 16 }),
      ),
    ).toBe(false)
    expect(
      (manager as any)._isCompatiblePersistedChunk(
        createPersistedChunk("chunk_wrong_resolution", { resolution: 4 }),
      ),
    ).toBe(false)

    await manager.updateAround(new ChunkCoord(0, 0))
    expect(console.warn).toHaveBeenCalled()

    manager.dispose()
  })
})

describe("terrain systems", () => {
  it("initializes, updates, samples, and disposes progressive terrain", async () => {
    const context = createContext()
    const player = new PlayerController(context)
    const terrain = new ProgressiveTerrainSystem(context, player)

    await terrain.initialize()
    expect(terrain.getHeightAt(0, 0)).toBeTypeOf("number")

    ;(terrain as any)._isRefreshing = true
    await (terrain as any)._refreshChunks()
    ;(terrain as any)._isRefreshing = false

    terrain.update(0.016)
    ;(terrain as any)._isRefreshing = true
    ;(player as any)._camera.position.x = 500
    terrain.update(0.016)
    ;(terrain as any)._isRefreshing = false
    ;(player as any)._camera.position.x = 1000
    terrain.update(0.016)

    terrain.dispose()
  })

  it("keeps legacy test terrain covered while it exists", () => {
    const context = createContext()
    const terrain = new TestTerrainSystem(context)

    terrain.initialize()
    terrain.update(0.016)
  })
})

describe("main entrypoint", () => {
  it("throws when required DOM elements are missing", async () => {
    vi.resetModules()
    await expect(import("../src/main")).rejects.toThrow("Missing #game-canvas element.")

    vi.resetModules()
    document.body.innerHTML = `<canvas id="game-canvas"></canvas>`
    await expect(import("../src/main")).rejects.toThrow("Missing options menu elements.")
  })

  it("wires options UI and shutdown", async () => {
    vi.resetModules()
    document.body.innerHTML = `
      <canvas id="game-canvas"></canvas>
      <button id="options-button" type="button">Options</button>
      <section id="options-panel" hidden></section>
      <input id="invert-mouse-y" type="checkbox" />
    `

    await import("../src/main")

    const optionsButton = document.querySelector<HTMLButtonElement>("#options-button")
    const optionsPanel = document.querySelector<HTMLElement>("#options-panel")
    const invertMouseInput = document.querySelector<HTMLInputElement>("#invert-mouse-y")

    optionsButton?.click()
    expect(optionsPanel?.hidden).toBe(false)

    invertMouseInput!.checked = true
    invertMouseInput?.dispatchEvent(new Event("change"))
    expect(loadGameSettings()).toEqual({ invertMouseY: true })

    window.dispatchEvent(new Event("beforeunload"))
  })
})

describe("game runtime", () => {
  it("starts, renders, updates settings, resizes, and disposes", async () => {
    const { Game } = await import("../src/app/Game")
    const canvas = document.createElement("canvas")
    const game = new Game(canvas)

    await game.start()
    game.updateSettings({ invertMouseY: true })

    window.dispatchEvent(new Event("resize"))
    ;((game as any)._context.engine.renderLoop as () => void)()
    game.dispose()

    expect((game as any)._context).toBeNull()
  })
})

function createPersistedChunk(
  key: string,
  overrides: Partial<PersistedChunkData> = {},
): PersistedChunkData {
  return {
    version: 1,
    key,
    coordX: 0,
    coordZ: 0,
    worldSeed: 1337,
    generatorVersion: 1,
    chunkSizeMeters: 8,
    resolution: 2,
    heights: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    props: [],
    mutations: [],
    generatedAt: 1,
    lastVisitedAt: 1,
    ...overrides,
  }
}

class MemoryChunkRepository implements ChunkRepository {
  public readonly items = new Map<string, PersistedChunkData>()
  public readonly savedKeys: string[] = []
  public failLoad = false
  public failSave = false

  public async getChunk(key: string): Promise<PersistedChunkData | null> {
    if (this.failLoad) {
      throw new Error("load failed")
    }

    return this.items.get(key) ?? null
  }

  public async saveChunk(chunk: PersistedChunkData): Promise<void> {
    if (this.failSave) {
      throw new Error("save failed")
    }

    this.savedKeys.push(chunk.key)
    this.items.set(chunk.key, chunk)
  }

  public async deleteChunk(key: string): Promise<void> {
    this.items.delete(key)
  }

  public async listChunkKeys(): Promise<string[]> {
    return [...this.items.keys()]
  }
}
