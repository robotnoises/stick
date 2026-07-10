// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AnimalSystem } from "../src/animals/AnimalSystem"
import { FishController } from "../src/animals/fish/FishController"
import { FishMeshFactory } from "../src/animals/fish/FishMeshFactory"
import { defaultGameConfig } from "../src/app/GameConfig"
import { EngineContext } from "../src/app/EngineContext"
import { defaultGameSettings, loadGameSettings, saveGameSettings } from "../src/app/GameSettings"
import { DebugOverlay } from "../src/debug/DebugOverlay"
import { BabylonBootstrap } from "../src/engine/BabylonBootstrap"
import { LightingController } from "../src/environment/LightingController"
import { CloudSystem } from "../src/environment/CloudSystem"
import { DistantBackdropSystem } from "../src/environment/DistantBackdropSystem"
import { TimeOfDaySystem } from "../src/environment/TimeOfDaySystem"
import { createCoreBackpack } from "../src/items/CoreItems"
import { FlashlightController } from "../src/items/FlashlightController"
import { InventorySystem } from "../src/items/InventorySystem"
import type { Item, ItemUseResult } from "../src/items/Item"
import { SolarFlashlightItem } from "../src/items/implementations/SolarFlashlightItem"
import { Compass } from "../src/player/Compass"
import { PlayerController } from "../src/player/PlayerController"
import { ChunkCoord } from "../src/world/ChunkCoord"
import { ChunkManager } from "../src/world/ChunkManager"
import { ProgressiveTerrainSystem } from "../src/world/terrain/ProgressiveTerrainSystem"
import { TerrainChunk } from "../src/world/terrain/TerrainChunk"
import { TerrainMaterial, type ChunkTerrainData } from "../src/world/terrain/TerrainTypes"
import { WorldBoundsHelper } from "../src/world/WorldBounds"
import { TerrainGenerator } from "../src/world/generation/TerrainGenerator"
import { TerrainGeneratorWorkerClient } from "../src/world/generation/TerrainGeneratorWorkerClient"
import type {
  TerrainGenerationRequest,
  TerrainGenerationResponse,
} from "../src/world/generation/TerrainGenerationTypes"
import {
  generateTerrainChunkResponse,
  initializeTerrainWorker,
} from "../src/world/generation/terrain.worker"
import { WorldFeatureGenerator } from "../src/world/generation/WorldFeatureGenerator"
import {
  WaterVolumeSampler,
  type WaterColumnSample,
  type WaterFeatureSampler,
} from "../src/world/water/WaterVolumeSampler"
import { LocalForageChunkRepository } from "../src/data/LocalForageChunkRepository"
import { LocalForageSaveGameRepository } from "../src/data/LocalForageSaveGameRepository"
import type { ChunkRepository, PersistedChunkData } from "../src/data/ChunkRepository"
import { TestTerrainSystem } from "../src/world/terrain/TestTerrainSystem"

const FakeColor3 = (globalThis as unknown).FakeColor3
const FakeColor4 = (globalThis as unknown).FakeColor4
const FakePointLight = (globalThis as unknown).FakePointLight
const FakeSpotLight = (globalThis as unknown).FakeSpotLight
const FakeVector3 = (globalThis as unknown).FakeVector3
const FakeEngine = (globalThis as unknown).FakeEngine
const FakeMesh = (globalThis as unknown).FakeMesh
const FakeScene = (globalThis as unknown).FakeScene
const FakeWebGPUEngine = (globalThis as unknown).FakeWebGPUEngine

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

function createWorldFeatures(): WorldFeatureGenerator {
  return new WorldFeatureGenerator({
    seed: defaultGameConfig.worldSeed,
    worldBounds: defaultGameConfig.worldBounds,
  })
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
    terrainMaterials: new Uint8Array([0, 1, 2, 3]),
    props: [
      {
        id: "pine-1",
        type: "pine",
        position: [0.5, 1, 0.5],
        rotationY: 0.5,
        scale: 1,
      },
      {
        id: "dead-pine-1",
        type: "deadPine",
        position: [0.75, 0, 0.75],
        rotationY: 0.1,
        scale: 1,
      },
      {
        id: "rock-1",
        type: "rock",
        position: [1, 0, 1],
        rotationY: 0,
        scale: 1,
      },
      {
        id: "log-1",
        type: "log",
        position: [1.5, 0, 1.5],
        rotationY: 0.25,
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
  it("advances time, wraps after 24 hours, and allows debug overrides", () => {
    const time = new TimeOfDaySystem(23.5, 3600)

    time.update(1)
    expect(time.day).toBe(2)
    expect(time.elapsedWorldSeconds).toBe(3600)
    expect(time.timeOfDayHours).toBeCloseTo(0.5)

    time.setTimeOfDayHours(25.25)
    expect(time.timeOfDayHours).toBeCloseTo(1.25)

    time.setDay(4.8)
    expect(time.day).toBe(4)

    time.setWorldTime(0, -1)
    expect(time.day).toBe(1)
    expect(time.timeOfDayHours).toBeCloseTo(23)

    time.setWorldClock(2, 10, -5)
    expect(time.day).toBe(2)
    expect(time.timeOfDayHours).toBe(10)
    expect(time.elapsedWorldSeconds).toBe(0)
  })

  it("computes compass heading from camera forward direction", () => {
    const camera = {
      getForwardRay: () => ({ direction: new FakeVector3(1, 0, 0) }),
    }

    expect(new Compass(camera as unknown).getHeadingDegrees()).toBeCloseTo(90)
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

    player.setPosition(2, 3, 4)
    expect(player.position).toEqual(new FakeVector3(2, 3, 4))

    player.setHeadingDegrees(-90)
    expect((context.scene.activeCamera as unknown).rotation.y).toBeCloseTo((270 * Math.PI) / 180)

    player.setInvertMouseY(true)
    player.setPositionClampProvider((x, z) => ({
      x: Math.min(Math.max(x, 0), 5),
      z: Math.min(Math.max(z, 0), 5),
    }))
    player.setPosition(10, 0, -10)
    player.setGroundHeightProvider((x, z) => x + z)
    player.update(0.016)

    expect(player.position.x).toBe(5)
    expect(player.position.z).toBe(0)
    expect(player.position.y).toBeCloseTo(player.position.x + player.position.z + 1.7)
    expect(player.waterState).toBe("grounded")
    expect(player.waterDepthMeters).toBe(0)

    const shallowWaterColumn: WaterColumnSample = {
      hasWater: true,
      featureId: "shallow_water",
      type: "lake",
      surfaceY: 1,
      bedY: 0,
      depthMeters: 1,
      distanceToShoreMeters: -1,
      flowDirectionX: 0,
      flowDirectionZ: 0,
      currentMetersPerSecond: 0,
    }
    const deepWaterColumn: WaterColumnSample = {
      ...shallowWaterColumn,
      featureId: "deep_water",
      surfaceY: 4,
      depthMeters: 4,
    }
    const dryWaterColumn: WaterColumnSample = {
      hasWater: false,
      featureId: null,
      type: null,
      surfaceY: 0,
      bedY: 0,
      depthMeters: 0,
      distanceToShoreMeters: Number.POSITIVE_INFINITY,
      flowDirectionX: 0,
      flowDirectionZ: 0,
      currentMetersPerSecond: 0,
    }
    const waterSampler = { sampleColumn: vi.fn(() => shallowWaterColumn) }

    player.setWaterSampler(waterSampler)
    player.setPosition(0, 10, 0)
    player.setGroundHeightProvider(() => 0)
    player.update(0.016)
    expect(player.waterState).toBe("wading")
    expect(player.waterDepthMeters).toBe(1)
    expect(player.position.y).toBe(1.7)
    expect((context.scene.activeCamera as unknown as { speed: number }).speed).toBe(0.16)

    waterSampler.sampleColumn.mockReturnValue(deepWaterColumn)
    player.setPosition(0, 3, 0)
    player.update(1)
    expect(player.waterState).toBe("submerged")
    expect(player.waterDepthMeters).toBe(4)
    expect(player.position.y).toBeCloseTo(2.78)
    player.update(10)
    expect(player.position.y).toBeGreaterThanOrEqual(1)

    waterSampler.sampleColumn.mockReturnValue(dryWaterColumn)
    player.update(0.016)
    expect(player.waterState).toBe("grounded")
    expect(player.waterDepthMeters).toBe(0)
    expect((context.scene.activeCamera as unknown as { speed: number }).speed).toBe(0.25)

    expect(player.headingDegrees).toBe(0)
    expect(player.forwardDirection).toEqual(new FakeVector3(0, 0, 1))
    expect(context.scene.activeCamera).toBeTruthy()

    player.dispose()
    context.canvas.click()
    expect(requestPointerLock).toHaveBeenCalledOnce()
  })

  it("renders, edits, and removes debug overlay", () => {
    const player = {
      position: new FakeVector3(1.23, 4.56, 7.89),
      headingDegrees: 123,
      waterState: "grounded",
      waterDepthMeters: 0,
      setPosition: vi.fn((x: number, y: number, z: number) => {
        player.position = new FakeVector3(x, y, z)
      }),
      setHeadingDegrees: vi.fn((heading: number) => {
        player.headingDegrees = heading
      }),
    }
    const time = new TimeOfDaySystem(8.5, 1)
    const resetTerrainCache = vi.fn()
    const createNewWorld = vi.fn()
    const setChunkBoundariesDebugEnabled = vi.fn()
    const setWorldSeed = vi.fn()
    const overlay = new DebugOverlay(player as unknown, time, {
      createNewWorld,
      getDebugMapData: () => ({
        worldBounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 },
        playerPosition: { x: 100, z: -200 },
        playerHeadingDegrees: 90,
        chunkSizeMeters: 64,
        lakes: [
          {
            id: "debug_lake",
            centerX: 200,
            centerZ: 100,
            radiusX: 150,
            radiusZ: 90,
            shoreFalloffMeters: 20,
          },
        ],
        rivers: [
          {
            id: "debug_river",
            points: [
              [-800, 800],
              [0, 0],
              [800, -800],
            ],
            widthMeters: 24,
            bankFalloffMeters: 16,
          },
        ],
      }),
      getTerrainStreamingStats: () => ({
        activeChunkCount: 3,
        queuedChunkCount: 2,
        inFlightChunkCount: 1,
        cachedChunkDataCount: 4,
        maxChunkLoadsPerFrame: 1,
        terrainGeneration: {
          workerAvailable: true,
          pendingRequestCount: 1,
          completedWorkerRequestCount: 5,
          fallbackGenerationCount: 0,
          workerErrorCount: 1,
          lastWorkerErrorMessage: "test worker warning",
          lastGenerationMilliseconds: 2.25,
          averageGenerationMilliseconds: 3.5,
        },
        terrainMeshBuild: {
          builtChunkCount: 7,
          lastBuildMilliseconds: 4.25,
          averageBuildMilliseconds: 5.5,
        },
      }),
      getChunkBoundariesDebugEnabled: () => false,
      getWorldSeed: () => 1337,
      resetTerrainCache,
      setChunkBoundariesDebugEnabled,
      setWorldSeed,
    })

    expect(overlay.visible).toBe(false)
    overlay.setVisible(true)
    overlay.update(0.016)
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("elevation: 2.9m")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("heading: 123°")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("day: 1")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain(
      "chunks: active 3, queued 2, loading 1",
    )
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("chunk cache: 4")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("budget: 1/frame")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain(
      "terrain gen: worker, pending 1",
    )
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("worker done: 5")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("fallback: 0")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("worker errors: 1")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain(
      "worker error: test worker warning",
    )
    expect(document.querySelector("#debug-overlay")?.textContent).toContain(
      "terrain gen ms: last 2.3, avg 3.5",
    )
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("mesh builds: 7")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain(
      "mesh build ms: last 4.3, avg 5.5",
    )

    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    overlay.update(0.016)
    expect(document.querySelector("#debug-overlay-editor")).toBeTruthy()
    expect(document.querySelector<HTMLFormElement>("#debug-overlay-editor")?.noValidate).toBe(true)
    expect(document.querySelector<HTMLInputElement>("input[name='positionX']")?.step).toBe("any")
    expect(document.querySelector<HTMLInputElement>("input[name='chunkBoundaries']")?.checked).toBe(
      false,
    )

    document
      .querySelector<HTMLButtonElement>("#debug-overlay-editor button[type='button']")
      ?.click()
    expect(document.querySelector("#debug-overlay-editor")).toBeNull()

    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[1]
      ?.click()
    let debugMapSvg = document.querySelector<SVGSVGElement>("#debug-world-map-modal svg")!

    expect(debugMapSvg.getAttribute("role")).toBe("img")
    expect(
      document.querySelectorAll("#debug-world-map-modal .debug-map-chunk-grid").length,
    ).toBeGreaterThan(0)
    expect(document.querySelectorAll("#debug-world-map-modal .debug-map-lake").length).toBe(1)
    expect(
      document.querySelectorAll("#debug-world-map-modal .debug-map-lake-shore-falloff").length,
    ).toBe(1)
    expect(document.querySelectorAll("#debug-world-map-modal .debug-map-river").length).toBe(1)
    expect(
      document.querySelectorAll("#debug-world-map-modal .debug-map-river-bank-falloff").length,
    ).toBe(1)
    expect(
      document.querySelectorAll("#debug-world-map-modal .debug-map-player-heading").length,
    ).toBe(3)
    document.querySelectorAll<HTMLButtonElement>("#debug-world-map-panel button")[1]?.click()
    expect(document.querySelector("#debug-world-map-modal")).toBeNull()
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[1]
      ?.click()
    debugMapSvg = document.querySelector<SVGSVGElement>("#debug-world-map-modal svg")!
    Object.defineProperty(debugMapSvg, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 640, height: 640 }),
    })
    debugMapSvg.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: 320, clientY: 320 }),
    )
    document.querySelectorAll<HTMLButtonElement>("#debug-world-map-panel button")[0]?.click()
    document.querySelectorAll<HTMLButtonElement>("#debug-world-map-panel button")[0]?.click()
    document.querySelectorAll<HTMLButtonElement>("#debug-world-map-panel button")[0]?.click()
    vi.spyOn(window, "confirm").mockReturnValueOnce(false)
    debugMapSvg.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: 320, clientY: 320 }),
    )
    expect(document.querySelector("#debug-world-map-modal")).toBeTruthy()
    vi.spyOn(window, "confirm").mockReturnValueOnce(true)
    debugMapSvg.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: 320, clientY: 320 }),
    )
    expect(player.setPosition).toHaveBeenCalledWith(0, 4.56, 0)
    expect(document.querySelector("#debug-world-map-modal")).toBeNull()

    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    vi.spyOn(window, "confirm").mockReturnValueOnce(false)
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[2]
      ?.click()
    expect(resetTerrainCache).not.toHaveBeenCalled()

    vi.spyOn(window, "confirm").mockReturnValueOnce(true)
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[2]
      ?.click()
    expect(resetTerrainCache).toHaveBeenCalledOnce()

    vi.spyOn(window, "confirm").mockReturnValueOnce(false)
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[3]
      ?.click()
    expect(createNewWorld).not.toHaveBeenCalled()

    vi.spyOn(window, "confirm").mockReturnValueOnce(true)
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[3]
      ?.click()
    expect(createNewWorld).toHaveBeenCalledOnce()

    document.querySelector<HTMLInputElement>("input[name='positionX']")!.value = "10"
    document.querySelector<HTMLInputElement>("input[name='positionY']")!.value = "11"
    document.querySelector<HTMLInputElement>("input[name='positionZ']")!.value = "12"
    document.querySelector<HTMLInputElement>("input[name='heading']")!.value = "270"
    document.querySelector<HTMLInputElement>("input[name='day']")!.value = "3"
    document.querySelector<HTMLInputElement>("input[name='timeOfDay']")!.value = "21.5"
    document.querySelector<HTMLInputElement>("input[name='worldSeed']")!.value = "1337"
    document.querySelector<HTMLInputElement>("input[name='chunkBoundaries']")!.checked = true
    ;(overlay as unknown)._readNumber(
      { elements: { namedItem: () => ({ value: "not-a-number" }) } },
      "missing",
      42,
    )
    document
      .querySelector<HTMLFormElement>("#debug-overlay-editor")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }))

    expect(player.setPosition).toHaveBeenCalledWith(10, 11, 12)
    expect(player.setHeadingDegrees).toHaveBeenCalledWith(270)
    expect(time.day).toBe(3)
    expect(time.timeOfDayHours).toBe(21.5)
    expect(setChunkBoundariesDebugEnabled).toHaveBeenCalledWith(true)
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("time: 21.50h")

    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    document.querySelector<HTMLInputElement>("input[name='worldSeed']")!.value = "999"
    vi.spyOn(window, "confirm").mockReturnValueOnce(false)
    document
      .querySelector<HTMLFormElement>("#debug-overlay-editor")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }))
    expect(setWorldSeed).not.toHaveBeenCalled()
    vi.spyOn(window, "confirm").mockReturnValueOnce(true)
    document
      .querySelector<HTMLFormElement>("#debug-overlay-editor")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }))
    expect(setWorldSeed).toHaveBeenCalledWith(999)

    overlay.dispose()
    expect(document.querySelector("#debug-overlay")).toBeNull()

    const overlayWithoutActions = new DebugOverlay(player as unknown, time)

    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[1]
      ?.click()
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[2]
      ?.click()
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[3]
      ?.click()
    document
      .querySelector<HTMLFormElement>("#debug-overlay-editor")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }))
    overlayWithoutActions.update(0.016)
    expect(document.querySelector("#debug-overlay")?.textContent).not.toContain("chunks: active")
    overlayWithoutActions.dispose()

    const overlayWithoutGenerationStats = new DebugOverlay(player as unknown, time, {
      getTerrainStreamingStats: () => ({
        activeChunkCount: 0,
        queuedChunkCount: 0,
        inFlightChunkCount: 0,
        cachedChunkDataCount: 0,
        maxChunkLoadsPerFrame: 1,
        terrainGeneration: null,
        terrainMeshBuild: {
          builtChunkCount: 0,
          lastBuildMilliseconds: null,
          averageBuildMilliseconds: null,
        },
      }),
    })

    overlayWithoutGenerationStats.update(0.016)
    expect(document.querySelector("#debug-overlay")?.textContent).not.toContain("terrain gen:")
    overlayWithoutGenerationStats.dispose()

    const unlimitedBudgetOverlay = new DebugOverlay(player as unknown, time, {
      getTerrainStreamingStats: () => ({
        activeChunkCount: 0,
        queuedChunkCount: 0,
        inFlightChunkCount: 0,
        cachedChunkDataCount: 0,
        maxChunkLoadsPerFrame: null,
        terrainGeneration: {
          workerAvailable: false,
          pendingRequestCount: 0,
          completedWorkerRequestCount: 0,
          fallbackGenerationCount: 1,
          workerErrorCount: 0,
          lastWorkerErrorMessage: null,
          lastGenerationMilliseconds: null,
          averageGenerationMilliseconds: null,
        },
        terrainMeshBuild: {
          builtChunkCount: 0,
          lastBuildMilliseconds: null,
          averageBuildMilliseconds: null,
        },
      }),
    })

    unlimitedBudgetOverlay.setVisible(true)
    unlimitedBudgetOverlay.update(0.016)
    expect(document.querySelector("#debug-overlay")?.textContent).toContain(
      "budget: unlimited/frame",
    )
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("terrain gen: fallback")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain(
      "terrain gen ms: last n/a, avg n/a",
    )
    unlimitedBudgetOverlay.dispose()
  })
})

describe("backpack and inventory", () => {
  it("creates core items, selects, uses, and discards items", () => {
    const flashlightUseAction = createTestFlashlightUseAction("Test flashlight toggled.")
    const backpack = createCoreBackpack(flashlightUseAction)
    const copiedItems = backpack.items

    copiedItems.pop()
    expect(backpack.items.map((item) => item.name)).toEqual([
      "Flint & steel",
      "Knife",
      "Canteen",
      "Solar flashlight",
      "Blank map",
    ])
    expect(backpack.selectedItem).toBeNull()
    expect(backpack.useSelectedItem()).toEqual({ success: false, message: "No item selected." })
    expect(backpack.selectItem("missing")).toBe(false)

    for (const item of backpack.items) {
      expect(item.source).toBe("core")
      expect(item.discardable).toBe(true)
      expect(item.use().success).toBe(true)
    }

    expect(backpack.selectItem("core_solar_flashlight")).toBe(true)
    expect(backpack.useSelectedItem().message).toBe("Test flashlight toggled.")
    expect(flashlightUseAction.toggle).toHaveBeenCalledTimes(2)

    expect(backpack.selectItem("core_canteen")).toBe(true)
    expect(backpack.selectedItem?.name).toBe("Canteen")
    expect(backpack.useSelectedItem().message).toBe("You check the canteen.")

    expect(backpack.discardItem("core_canteen")).toBe(true)
    expect(backpack.selectedItem).toBeNull()
    expect(backpack.getItem("core_canteen")).toBeNull()
    expect(backpack.discardItem("missing")).toBe(false)

    backpack.addItem(new TestFoundItem())
    expect(backpack.selectItem("found_test_item")).toBe(true)
    backpack.clearSelection()
    expect(backpack.selectedItem).toBeNull()
  })

  it("uses an injected flashlight action in isolation", () => {
    const flashlightUseAction = {
      toggle: vi.fn(() => ({ enabled: true, message: "Injected flashlight enabled." })),
    }
    const item = new SolarFlashlightItem(flashlightUseAction)

    expect(item.use()).toEqual({ success: true, message: "Injected flashlight enabled." })
    expect(flashlightUseAction.toggle).toHaveBeenCalledOnce()
  })

  it("lights the space in front of the player with a flashlight controller", () => {
    const context = createContext()
    const player = {
      position: new FakeVector3(5, 6, 7),
      forwardDirection: new FakeVector3(0, 0, 2),
    }
    const flashlight = new FlashlightController(context, player as unknown)

    expect((flashlight as unknown)._light).toBeInstanceOf(FakeSpotLight)
    expect((flashlight as unknown)._spillLight).toBeInstanceOf(FakeSpotLight)
    expect((flashlight as unknown)._fillLight).toBeInstanceOf(FakePointLight)
    expect((flashlight as unknown)._spillLight.angle).toBeGreaterThan((flashlight as unknown)._light.angle)
    expect(flashlight.enabled).toBe(false)
    expect((flashlight as unknown)._light.intensity).toBe(0)
    expect((flashlight as unknown)._spillLight.intensity).toBe(0)
    expect((flashlight as unknown)._fillLight.intensity).toBe(0)

    expect(flashlight.toggle()).toEqual({ enabled: true, message: "Solar flashlight on." })
    expect(flashlight.enabled).toBe(true)
    expect((flashlight as unknown)._light.intensity).toBeGreaterThan(0)
    expect((flashlight as unknown)._spillLight.intensity).toBeGreaterThan(0)
    expect((flashlight as unknown)._spillLight.intensity).toBeLessThan(
      (flashlight as unknown)._light.intensity,
    )
    expect((flashlight as unknown)._fillLight.intensity).toBeGreaterThan(0)
    expect((flashlight as unknown)._light.position).toEqual(new FakeVector3(5, 6, 7.35))
    expect((flashlight as unknown)._spillLight.position).toEqual(new FakeVector3(5, 6, 7.35))
    expect((flashlight as unknown)._fillLight.position).toEqual(new FakeVector3(5, 6, 12.35))
    expect((flashlight as unknown)._light.direction).toEqual(new FakeVector3(0, 0, 1))
    expect((flashlight as unknown)._spillLight.direction).toEqual(new FakeVector3(0, 0, 1))

    player.position = new FakeVector3(1, 2, 3)
    player.forwardDirection = new FakeVector3(2, 0, 0)
    flashlight.update(0.016)
    expect((flashlight as unknown)._light.position).toEqual(new FakeVector3(1.35, 2, 3))
    expect((flashlight as unknown)._spillLight.position).toEqual(new FakeVector3(1.35, 2, 3))
    expect((flashlight as unknown)._fillLight.position).toEqual(new FakeVector3(6.35, 2, 3))
    expect((flashlight as unknown)._light.direction).toEqual(new FakeVector3(1, 0, 0))
    expect((flashlight as unknown)._spillLight.direction).toEqual(new FakeVector3(1, 0, 0))

    flashlight.setEnabled(false)
    expect((flashlight as unknown)._spillLight.intensity).toBe(0)
    expect((flashlight as unknown)._fillLight.intensity).toBe(0)
    expect(flashlight.toggle()).toEqual({ enabled: true, message: "Solar flashlight on." })
    expect(flashlight.toggle()).toEqual({ enabled: false, message: "Solar flashlight off." })

    flashlight.dispose()
    expect((flashlight as unknown)._light.disposed).toBe(true)
    expect((flashlight as unknown)._spillLight.disposed).toBe(true)
    expect((flashlight as unknown)._fillLight.disposed).toBe(true)
  })

  it("opens inventory, selects one item, and uses the selected item", () => {
    const backpack = createCoreBackpack(createTestFlashlightUseAction())
    const inventory = new InventorySystem(backpack)

    inventory.update(0.016)
    expect(document.querySelector<HTMLElement>("#inventory-panel")?.hidden).toBe(true)
    expect(inventory.selectedItemName).toBeNull()

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }))
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyU" }))
    expect(document.querySelector("#inventory-panel")?.textContent).toContain("No item selected.")

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyI" }))
    expect(document.querySelector<HTMLElement>("#inventory-panel")?.hidden).toBe(false)

    document.querySelector<HTMLElement>("#inventory-panel")?.click()
    document
      .querySelector<HTMLButtonElement>("button[data-item-id='core_flint_and_steel']")
      ?.click()
    expect(inventory.selectedItemName).toBe("Flint & steel")
    expect(document.querySelector("#inventory-panel")?.textContent).toContain(
      "Flint & steel selected.",
    )

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyU" }))
    expect(document.querySelector("#inventory-panel")?.textContent).toContain(
      "You ready the flint and steel.",
    )

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyI" }))
    expect(document.querySelector<HTMLElement>("#inventory-panel")?.hidden).toBe(true)

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyI" }))
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" }))
    expect(document.querySelector<HTMLElement>("#inventory-panel")?.hidden).toBe(true)

    inventory.dispose()
    expect(document.querySelector("#inventory-panel")).toBeNull()
  })
})

describe("animals", () => {
  it("spawns, updates, and disposes runtime fish without persisting spawn identity", () => {
    const context = createContext()
    const player = { position: new FakeVector3(0, 1, 0) }
    const waterFeatures: WaterFeatureSampler = {
      sample: (worldX, worldZ) => {
        if (Math.hypot(worldX, worldZ) > 10) {
          return { water: null }
        }

        return {
          water: {
            feature: {
              id: "test_pond",
              centerX: 0,
              centerZ: 0,
              radiusX: 10,
              radiusZ: 10,
              waterLevelMeters: 2,
              depthMeters: 2,
              shoreFalloffMeters: 2,
            },
            type: "lake",
            normalizedDistance: 0,
            distanceToShoreMeters: -2,
            waterLevelMeters: 2,
            isUnderWater: true,
            isShore: false,
          },
        }
      },
    }
    const waterSampler = new WaterVolumeSampler({
      waterFeatures,
      terrainHeightProvider: () => 0,
    })
    const animalSystem = new AnimalSystem(context, player as unknown, waterSampler, {
      activeRadiusMeters: 8,
      cellSizeMeters: 4,
      maxFish: 2,
      fishSpawnChance: 1,
      random: () => 0.5,
    })

    animalSystem.update(0.016)
    expect(animalSystem.activeFishCount).toBe(2)
    expect((animalSystem as unknown)._fish.has("fish_runtime_0")).toBe(true)
    expect((animalSystem as unknown)._fish.has("fish_runtime_1")).toBe(true)

    ;(animalSystem as unknown)._maxFish = 3
    animalSystem.update(0.016)
    expect(animalSystem.activeFishCount).toBe(3)

    const firstFish = [...(animalSystem as unknown)._fish.values()][0]
    const firstFishBody = firstFish._body

    animalSystem.update(0.5)
    expect(firstFish.position.y).toBeGreaterThan(0)
    expect(firstFishBody.position).toBeInstanceOf(FakeVector3)

    player.position = new FakeVector3(100, 1, 100)
    animalSystem.update(0.016)
    expect(animalSystem.activeFishCount).toBe(0)
    expect(firstFishBody.disposed).toBe(true)

    ;(animalSystem as unknown)._maxFish = 2
    player.position = new FakeVector3(0, 1, 0)
    animalSystem.update(0.016)
    expect(animalSystem.activeFishCount).toBe(2)
    expect((animalSystem as unknown)._fish.has("fish_runtime_0")).toBe(false)
    expect((animalSystem as unknown)._fish.has("fish_runtime_3")).toBe(true)

    animalSystem.dispose()
    expect(animalSystem.activeFishCount).toBe(0)
  })

  it("spawns, updates, and disposes ambient runtime birds", () => {
    const context = createContext()
    const player = { position: new FakeVector3(0, 1, 0) }
    const waterFeatures: WaterFeatureSampler = { sample: () => ({ water: null }) }
    const waterSampler = new WaterVolumeSampler({
      waterFeatures,
      terrainHeightProvider: () => 0,
    })
    const animalSystem = new AnimalSystem(context, player as unknown, waterSampler, {
      activeRadiusMeters: 20,
      maxBirds: 1,
      birdSpawnChance: 1,
      terrainHeightProvider: (x, z) => x * 0.01 + z * 0.01,
      random: () => 0.5,
    })

    animalSystem.update(0.5)
    expect(animalSystem.activeBirdCount).toBe(1)
    expect((animalSystem as unknown)._birds.has("bird_runtime_0")).toBe(true)

    const bird = [...(animalSystem as unknown)._birds.values()][0]
    const birdBody = bird._body

    expect(bird.id).toBe("bird_runtime_0")
    expect(bird.position.y).toBeGreaterThan(8)
    animalSystem.update(1)
    expect(birdBody.position).toBeInstanceOf(FakeVector3)

    player.position = new FakeVector3(200, 1, 200)
    animalSystem.update(0.016)
    expect(animalSystem.activeBirdCount).toBe(0)
    expect(birdBody.disposed).toBe(true)

    animalSystem.dispose()
  })

  it("spawns fireflies only during evening and night", () => {
    const context = createContext()
    const player = { position: new FakeVector3(0, 1, 0) }
    const waterFeatures: WaterFeatureSampler = { sample: () => ({ water: null }) }
    const waterSampler = new WaterVolumeSampler({
      waterFeatures,
      terrainHeightProvider: () => 0,
    })
    const time = { timeOfDayHours: 20 }
    const animalSystem = new AnimalSystem(context, player as unknown, waterSampler, {
      activeRadiusMeters: 20,
      maxFireflies: 2,
      fireflySpawnChance: 1,
      terrainHeightProvider: (x, z) => x * 0.01 + z * 0.01,
      timeProvider: time,
      random: () => 0.5,
    })

    animalSystem.update(0.5)
    expect(animalSystem.activeFireflyCount).toBe(1)
    expect((animalSystem as unknown)._fireflies.has("firefly_runtime_0")).toBe(true)

    const firefly = [...(animalSystem as unknown)._fireflies.values()][0]
    const fireflyBody = firefly._body

    expect(firefly.id).toBe("firefly_runtime_0")
    expect(firefly.position.y).toBeGreaterThan(0.3)
    animalSystem.update(1)
    expect(fireflyBody.position).toBeInstanceOf(FakeVector3)

    time.timeOfDayHours = 4
    animalSystem.update(0.016)
    expect(animalSystem.activeFireflyCount).toBe(0)
    expect(fireflyBody.disposed).toBe(true)

    time.timeOfDayHours = 12
    animalSystem.update(0.016)
    expect(animalSystem.activeFireflyCount).toBe(0)

    animalSystem.dispose()
  })

  it("handles fish steering fallback branches", () => {
    const context = createContext()
    const factory = new FishMeshFactory(context)
    const validColumn: WaterColumnSample = {
      hasWater: true,
      featureId: "test_water",
      type: "lake" as const,
      surfaceY: 2,
      bedY: 0,
      depthMeters: 2,
      distanceToShoreMeters: -2,
      flowDirectionX: 0,
      flowDirectionZ: 0,
      currentMetersPerSecond: 0,
    }
    const dryColumn: WaterColumnSample = {
      hasWater: false,
      featureId: null,
      type: null,
      surfaceY: 0,
      bedY: 0,
      depthMeters: 0,
      distanceToShoreMeters: Number.POSITIVE_INFINITY,
      flowDirectionX: 0,
      flowDirectionZ: 0,
      currentMetersPerSecond: 0,
    }
    const sampler = {
      sampleColumn: vi.fn(() => validColumn),
    }
    const fish = new FishController({
      id: "branch_fish",
      visual: factory.createFish("branch_fish", new FakeVector3(0, 1, 0), 1),
      initialPosition: new FakeVector3(0, 1, 0),
      waterSampler: sampler as unknown,
      player: { position: new FakeVector3(20, 1, 20) },
      random: () => 0.5,
    })

    ;(fish as unknown)._target = { x: 0, y: 1, z: 0 }
    fish.update(0.016)
    expect(fish.id).toBe("branch_fish")
    expect(fish.position).toBeInstanceOf(FakeVector3)

    sampler.sampleColumn
      .mockReturnValueOnce(validColumn)
      .mockReturnValueOnce(validColumn)
      .mockReturnValueOnce(dryColumn)
    ;(fish as unknown)._target = { x: 3, y: 1, z: 0 }
    fish.update(0.5)
    expect(sampler.sampleColumn).toHaveBeenCalled()

    sampler.sampleColumn.mockReturnValue(dryColumn)
    ;(fish as unknown)._position = new FakeVector3(40, 1, 40)
    fish.update(0.016)
    fish.dispose()
  })
})

describe("environment backdrop", () => {
  it("creates day-only cloud layers that follow the player and fade at night", () => {
    const context = createContext()
    const time = new TimeOfDaySystem(12, 1)
    const player = { position: new FakeVector3(10, 2, 20) }
    const clouds = new CloudSystem(context, time, player as unknown)

    clouds.update(1)

    const layers = (clouds as unknown)._clouds as Array<{
      readonly mesh: InstanceType<typeof FakeMesh>
    }>
    const material = (clouds as unknown)._cloudMaterial
    const firstCloudMesh = layers[0]!.mesh

    expect(layers.length).toBeGreaterThan(0)
    expect(material.alpha).toBeGreaterThan(0)
    expect(firstCloudMesh.position.x).not.toBe(0)
    expect(firstCloudMesh.position.z).not.toBe(0)
    expect(firstCloudMesh.vertexData.positions.length).toBeGreaterThan(0)
    expect((clouds as unknown)._getCloudAlpha()).toBeGreaterThan(0)
    expect((clouds as unknown)._smoothStep(0, 1, -1)).toBe(0)
    expect((clouds as unknown)._smoothStep(0, 1, 2)).toBe(1)

    time.setTimeOfDayHours(0)
    clouds.update(1)
    expect(material.alpha).toBe(0)

    player.position = new FakeVector3(-5, 2, 7)
    time.setTimeOfDayHours(12)
    clouds.update(1)
    expect(layers[0]!.mesh.position.x).toBeLessThan(500)

    clouds.dispose()
    expect(firstCloudMesh.disposed).toBe(true)
    expect(material.disposed).toBe(true)
  })

  it("creates a distant mountain ring that follows the player and fades at night", () => {
    const context = createContext()
    const player = { position: new FakeVector3(10, 2, 20) }
    const time = { timeOfDayHours: 12 }
    const backdrop = new DistantBackdropSystem(context, player as unknown, time)

    backdrop.update(0.016)

    const mesh = (backdrop as unknown)._mountainMesh
    const material = (backdrop as unknown)._mountainMaterial

    expect(mesh.name).toBe("distant-mountain-backdrop")
    expect(mesh.position.x).toBe(10)
    expect(mesh.position.z).toBe(20)
    expect(mesh.isPickable).toBe(false)
    expect(mesh.alwaysSelectAsActiveMesh).toBe(true)
    expect(mesh.vertexData.positions.length).toBeGreaterThan(0)
    expect(material.alpha).toBeGreaterThan(0.2)
    expect((backdrop as unknown)._ridgeNoise(0.25)).toBeGreaterThanOrEqual(0)
    expect((backdrop as unknown)._ridgeNoise(0.25)).toBeLessThanOrEqual(1)

    player.position = new FakeVector3(-5, 2, 7)
    time.timeOfDayHours = 0
    backdrop.update(0.016)
    expect(mesh.position.x).toBe(-5)
    expect(mesh.position.z).toBe(7)
    expect(material.alpha).toBeLessThan(0.08)

    backdrop.dispose()
    expect(mesh.disposed).toBe(true)
    expect(material.disposed).toBe(true)
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

  it("uses faint moonlight at night instead of direct sun lighting", () => {
    const context = createContext()
    const time = new TimeOfDaySystem(0, 1)
    const lighting = new LightingController(context, time)

    lighting.update(0.016)

    expect((lighting as unknown)._sun.intensity).toBe(0)
    expect((lighting as unknown)._moon.intensity).toBeGreaterThan(0)
    expect((lighting as unknown)._moon.intensity).toBeLessThan(0.3)
    expect((lighting as unknown)._ambient.intensity).toBeGreaterThan(0.08)

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

  it("checks positions and chunks against finite world bounds", () => {
    const bounds = new WorldBoundsHelper({ minX: -8, maxX: 8, minZ: -8, maxZ: 8 })

    expect(bounds.containsPosition(0, 0)).toBe(true)
    expect(bounds.containsPosition(9, 0)).toBe(false)
    expect(bounds.clampPosition(12, -12)).toEqual({ x: 8, z: -8 })
    expect(bounds.intersectsChunk(new ChunkCoord(0, 0), 8)).toBe(true)
    expect(bounds.intersectsChunk(new ChunkCoord(2, 0), 8)).toBe(false)
  })

  it("generates deterministic finite world lake features", () => {
    const bounds = { minX: -4000, maxX: 4000, minZ: -4000, maxZ: 4000 }
    const a = new WorldFeatureGenerator({ seed: 7, worldBounds: bounds })
    const b = new WorldFeatureGenerator({ seed: 7, worldBounds: bounds })
    const lake = a.lakes[0]!
    const underwaterSample = a.sample(lake.centerX, lake.centerZ)
    const shoreSample = a.sample(
      lake.centerX + lake.radiusX + lake.shoreFalloffMeters / 2,
      lake.centerZ,
    )
    const farSample = a.sample(bounds.maxX, bounds.maxZ)

    expect(WorldFeatureGenerator.version).toBe(1)
    expect(a.lakes.length).toBeGreaterThan(0)
    expect(a.lakes).toEqual(b.lakes)
    expect(underwaterSample.water?.feature.id).toBe(lake.id)
    expect(underwaterSample.water?.type).toBe("lake")
    expect(underwaterSample.water?.isUnderWater).toBe(true)
    expect(underwaterSample.water?.isShore).toBe(false)
    expect(shoreSample.water?.isUnderWater).toBe(false)
    expect(shoreSample.water?.isShore).toBe(true)
    expect(farSample.water?.distanceToShoreMeters).toBeTypeOf("number")
    expect(a.rivers.length).toBeGreaterThan(0)
    expect(a.getLakesIntersectingBounds(bounds).length).toBeGreaterThan(0)
    expect(a.getRiversIntersectingBounds(bounds).length).toBeGreaterThan(0)
    expect(
      a.getLakesIntersectingBounds({ minX: 100_000, maxX: 101_000, minZ: 100_000, maxZ: 101_000 }),
    ).toEqual([])
    const river = a.rivers[0]!
    const riverMidpointX = (river.points[0]![0] + river.points[1]![0]) / 2
    const riverMidpointZ = (river.points[0]![1] + river.points[1]![1]) / 2

    ;(a as unknown)._lakes = []
    expect(a.sample(riverMidpointX, riverMidpointZ).water?.type).toBe("river")
    expect(a.sample(riverMidpointX, riverMidpointZ).water?.isUnderWater).toBe(true)
    expect(
      a.getRiversIntersectingBounds({ minX: 100_000, maxX: 101_000, minZ: 100_000, maxZ: 101_000 }),
    ).toEqual([])
    expect((a as unknown)._chooseNearestWaterSample({ distanceToShoreMeters: 10 }, null)).toEqual({
      distanceToShoreMeters: 10,
    })
    expect((a as unknown)._getDistanceToSegmentMeters(3, 4, 0, 0, 0, 0)).toBe(5)
    ;(a as unknown)._rivers = [
      {
        ...river,
        widthMeters: 0,
        points: [
          [0, 0],
          [1, 0],
        ],
      },
    ]
    expect(a.sample(0.5, 0).water?.normalizedDistance).toBe(0)

    ;(a as unknown)._lakes = [
      { ...lake, id: "wide", centerX: 0, centerZ: 0, radiusX: 100, radiusZ: 100 },
      { ...lake, id: "equal", centerX: 0, centerZ: 0, radiusX: 100, radiusZ: 100 },
    ]
    ;(a as unknown)._rivers = []
    expect(a.sample(0, 0).water?.feature.id).toBe("wide")
    ;(a as unknown)._lakes = [
      { ...lake, id: "near", centerX: 0, centerZ: 0, radiusX: 10, radiusZ: 10 },
      { ...lake, id: "closer", centerX: 5, centerZ: 0, radiusX: 100, radiusZ: 100 },
    ]
    expect(a.sample(5, 0).water?.feature.id).toBe("closer")
    ;(a as unknown)._lakes.length = 0
    ;(a as unknown)._rivers.length = 0
    expect(a.lakes.length).toBe(0)
    expect(a.rivers.length).toBe(0)
    expect(a.sample(0, 0)).toEqual({ water: null })
  })

  it("samples gameplay water columns and submerged points", () => {
    const bounds = { minX: -512, maxX: 512, minZ: -512, maxZ: 512 }
    const waterFeatures = new WorldFeatureGenerator({ seed: 7, worldBounds: bounds })
    const terrainGenerator = new TerrainGenerator({
      seed: 7,
      chunkSizeMeters: 64,
      resolution: 4,
      worldFeatures: waterFeatures,
    })
    const sampler = new WaterVolumeSampler({
      waterFeatures,
      terrainHeightProvider: (worldX, worldZ) => terrainGenerator.getHeight(worldX, worldZ),
    })
    const lake = waterFeatures.lakes[0]!
    const lakeColumn = sampler.sampleColumn(lake.centerX, lake.centerZ)
    const lakeMidpointY = (lakeColumn.bedY + lakeColumn.surfaceY) / 2
    const lakePoint = sampler.samplePoint(lake.centerX, lakeMidpointY, lake.centerZ)
    const aboveLakePoint = sampler.samplePoint(lake.centerX, lakeColumn.surfaceY + 1, lake.centerZ)
    const belowLakePoint = sampler.samplePoint(lake.centerX, lakeColumn.bedY - 1, lake.centerZ)
    const shoreColumn = sampler.sampleColumn(
      lake.centerX + lake.radiusX + lake.shoreFalloffMeters / 2,
      lake.centerZ,
    )
    const farColumn = sampler.sampleColumn(bounds.maxX, bounds.maxZ)

    expect(lakeColumn.hasWater).toBe(true)
    expect(lakeColumn.featureId).toBe(lake.id)
    expect(lakeColumn.type).toBe("lake")
    expect(lakeColumn.depthMeters).toBeGreaterThan(0)
    expect(lakeColumn.distanceToShoreMeters).toBeLessThan(0)
    expect(lakeColumn.flowDirectionX).toBe(0)
    expect(lakeColumn.flowDirectionZ).toBe(0)
    expect(lakeColumn.currentMetersPerSecond).toBe(0)
    expect(lakePoint.isSubmerged).toBe(true)
    expect(lakePoint.depthBelowSurfaceMeters).toBeCloseTo(lakeColumn.surfaceY - lakeMidpointY)
    expect(lakePoint.heightAboveBedMeters).toBeCloseTo(lakeMidpointY - lakeColumn.bedY)
    expect(aboveLakePoint.isSubmerged).toBe(false)
    expect(aboveLakePoint.depthBelowSurfaceMeters).toBe(0)
    expect(belowLakePoint.isSubmerged).toBe(false)
    expect(belowLakePoint.heightAboveBedMeters).toBe(0)
    expect(shoreColumn.hasWater).toBe(false)
    expect(shoreColumn.featureId).toBe(lake.id)
    expect(shoreColumn.type).toBe("lake")
    expect(shoreColumn.distanceToShoreMeters).toBeGreaterThanOrEqual(0)
    expect(farColumn.hasWater).toBe(false)
    expect(farColumn.featureId).toBeNull()
    expect(farColumn.type).toBeNull()
    expect(farColumn.surfaceY).toBe(farColumn.bedY)
    expect(farColumn.distanceToShoreMeters).toBe(Number.POSITIVE_INFINITY)
  })

  it("reports river water current and dry fallback samples", () => {
    const riverFeature = {
      id: "test_river",
      points: [
        [0, 0],
        [0, -10],
        [0, -10],
        [10, -10],
      ] as ReadonlyArray<readonly [number, number]>,
      widthMeters: 4,
      depthMeters: 2,
      bankFalloffMeters: 3,
      waterLevelMeters: 5,
      waterProfile: [],
    }
    const riverFeatures: WaterFeatureSampler = {
      sample: () => ({
        water: {
          feature: riverFeature,
          type: "river",
          normalizedDistance: 0,
          distanceToShoreMeters: -2,
          waterLevelMeters: 5,
          isUnderWater: true,
          isShore: false,
        },
      }),
    }
    const riverSampler = new WaterVolumeSampler({
      waterFeatures: riverFeatures,
      terrainHeightProvider: () => 3,
    })
    const riverColumn = riverSampler.sampleColumn(0, -5)

    expect(riverColumn.hasWater).toBe(true)
    expect(riverColumn.featureId).toBe("test_river")
    expect(riverColumn.type).toBe("river")
    expect(riverColumn.surfaceY).toBe(5)
    expect(riverColumn.bedY).toBe(3)
    expect(riverColumn.depthMeters).toBe(2)
    expect(riverColumn.flowDirectionX).toBe(0)
    expect(riverColumn.flowDirectionZ).toBe(-1)
    expect(riverColumn.currentMetersPerSecond).toBe(0.2)
    expect(riverSampler.samplePoint(0, 4, -5).isSubmerged).toBe(true)

    const shallowFeatures: WaterFeatureSampler = {
      sample: () => ({
        water: {
          feature: riverFeature,
          type: "river",
          normalizedDistance: 0,
          distanceToShoreMeters: -1,
          waterLevelMeters: 5,
          isUnderWater: true,
          isShore: false,
        },
      }),
    }
    const shallowSampler = new WaterVolumeSampler({
      waterFeatures: shallowFeatures,
      terrainHeightProvider: () => 6,
    })
    const shallowColumn = shallowSampler.sampleColumn(0, 0)

    expect(shallowColumn.hasWater).toBe(false)
    expect(shallowColumn.depthMeters).toBe(0)
    expect(shallowColumn.currentMetersPerSecond).toBe(0)
    expect(shallowSampler.samplePoint(0, 5, 0).isSubmerged).toBe(false)

    const farLakeFeatures: WaterFeatureSampler = {
      sample: () => ({
        water: {
          feature: {
            id: "far_lake",
            centerX: 0,
            centerZ: 0,
            radiusX: 1,
            radiusZ: 1,
            waterLevelMeters: 2,
            depthMeters: 1,
            shoreFalloffMeters: 1,
          },
          type: "lake",
          normalizedDistance: 10,
          distanceToShoreMeters: 9,
          waterLevelMeters: 2,
          isUnderWater: false,
          isShore: false,
        },
      }),
    }
    const farLakeSampler = new WaterVolumeSampler({
      waterFeatures: farLakeFeatures,
      terrainHeightProvider: () => 11,
    })
    const emptyFeatures: WaterFeatureSampler = { sample: () => ({ water: null }) }
    const emptySampler = new WaterVolumeSampler({
      waterFeatures: emptyFeatures,
      terrainHeightProvider: () => -3,
    })
    const degenerateRiverFeatures: WaterFeatureSampler = {
      sample: () => ({
        water: {
          feature: {
            ...riverFeature,
            points: [
              [0, 0],
              [0, 0],
            ],
          },
          type: "river",
          normalizedDistance: 0,
          distanceToShoreMeters: -1,
          waterLevelMeters: 5,
          isUnderWater: true,
          isShore: false,
        },
      }),
    }
    const degenerateRiverSampler = new WaterVolumeSampler({
      waterFeatures: degenerateRiverFeatures,
      terrainHeightProvider: () => 3,
    })

    expect(farLakeSampler.sampleColumn(100, 100)).toEqual({
      hasWater: false,
      featureId: null,
      type: null,
      surfaceY: 11,
      bedY: 11,
      depthMeters: 0,
      distanceToShoreMeters: Number.POSITIVE_INFINITY,
      flowDirectionX: 0,
      flowDirectionZ: 0,
      currentMetersPerSecond: 0,
    })
    expect(emptySampler.samplePoint(0, -3, 0).isSubmerged).toBe(false)
    expect(degenerateRiverSampler.sampleColumn(0, 0).flowDirectionX).toBe(0)
    expect(degenerateRiverSampler.sampleColumn(0, 0).currentMetersPerSecond).toBe(0)
  })

  it("generates deterministic terrain data and props", () => {
    const generator = new TerrainGenerator({ seed: 7, chunkSizeMeters: 64, resolution: 4 })
    const a = generator.generateChunk(new ChunkCoord(2, 3))
    const b = generator.generateChunk(new ChunkCoord(2, 3))

    expect(a.key).toBe("chunk_2_3")
    expect(a.heights.length).toBe(25)
    expect(a.terrainMaterials.length).toBe(25)
    expect([...a.heights]).toEqual([...b.heights])
    expect([...a.terrainMaterials]).toEqual([...b.terrainMaterials])
    expect(a.props.length).toBeGreaterThan(0)
    expect(new Set(a.props.map((prop) => prop.type)).size).toBeGreaterThan(1)
    expect(generator.getTerrainMaterial(0, 0, -6)).toBe(TerrainMaterial.Sand)
    expect((generator as unknown)._choosePropType(TerrainMaterial.Sand, 0.94)).toBe("rock")
    expect((generator as unknown)._choosePropType(TerrainMaterial.Sand, 0.5)).toBeNull()

    const regionalElevation = (generator as unknown)._getRegionalElevation(120, -80)
    const rollingHills = (generator as unknown)._getRollingHillElevation(120, -80)
    const ridgeElevation = (generator as unknown)._getRidgeElevation(120, -80)
    const surfaceRoughness = (generator as unknown)._getSurfaceRoughness(120, -80)
    const layeredHeight = regionalElevation + rollingHills + ridgeElevation + surfaceRoughness

    expect(generator.getHeight(120, -80)).toBeCloseTo(layeredHeight)
    expect(Math.abs(regionalElevation)).toBeGreaterThan(Math.abs(surfaceRoughness))
    expect(ridgeElevation).toBeGreaterThanOrEqual(0)

    let foundDirt = false
    let foundNoisyLowlandSand = false

    for (let z = 0; z < 20 && (!foundDirt || !foundNoisyLowlandSand); z += 1) {
      for (let x = 0; x < 20 && (!foundDirt || !foundNoisyLowlandSand); x += 1) {
        foundDirt =
          foundDirt || generator.getTerrainMaterial(x * 13, z * 13, 0) === TerrainMaterial.Dirt
        foundNoisyLowlandSand =
          foundNoisyLowlandSand ||
          generator.getTerrainMaterial(x * 13, z * 13, -4) === TerrainMaterial.Sand
      }
    }

    const waterFeatures = new WorldFeatureGenerator({
      seed: 7,
      worldBounds: { minX: -512, maxX: 512, minZ: -512, maxZ: 512 },
    })
    const lake = waterFeatures.lakes[0]!
    const waterGenerator = new TerrainGenerator({
      seed: 7,
      chunkSizeMeters: 64,
      resolution: 4,
      worldFeatures: waterFeatures,
    })
    const lakeCenterHeight = waterGenerator.getHeight(lake.centerX, lake.centerZ)
    const shoreMaterial = waterGenerator.getTerrainMaterial(
      lake.centerX + lake.radiusX + lake.shoreFalloffMeters / 2,
      lake.centerZ,
    )
    const lakeProps = waterGenerator.generateChunk(
      ChunkCoord.fromWorldPosition(lake.centerX, lake.centerZ, 64),
    ).props
    const river = waterFeatures.rivers[0]!
    const riverMidpointX = (river.points[0]![0] + river.points[1]![0]) / 2
    const riverMidpointZ = (river.points[0]![1] + river.points[1]![1]) / 2
    const riverCenterHeight = waterGenerator.getHeight(riverMidpointX, riverMidpointZ)
    const riverBankMaterial = waterGenerator.getTerrainMaterial(
      riverMidpointX + river.widthMeters / 2 + river.bankFalloffMeters / 2,
      riverMidpointZ,
    )

    expect(foundDirt).toBe(true)
    expect(foundNoisyLowlandSand).toBe(true)
    expect(lakeCenterHeight).toBeLessThanOrEqual(lake.waterLevelMeters)
    expect(riverCenterHeight).toBeLessThanOrEqual(river.waterLevelMeters)
    expect(shoreMaterial).toBe(TerrainMaterial.Sand)
    expect(riverBankMaterial).toBeTypeOf("number")
    expect(
      lakeProps.every((prop) => prop.position[1] > lake.waterLevelMeters - lake.depthMeters),
    ).toBe(true)
    expect(generator.getHeight(1.5, 2.5)).toBe(generator.getHeight(1.5, 2.5))
    expect(generator.getTerrainMaterial(1.5, 2.5)).toBe(generator.getTerrainMaterial(1.5, 2.5))
  })

  it("generates terrain data in worker-compatible request/response shapes", () => {
    const request: TerrainGenerationRequest = {
      requestId: 7,
      seed: 1337,
      chunkX: 1,
      chunkZ: -1,
      chunkSizeMeters: 8,
      resolution: 2,
      worldBounds: defaultGameConfig.worldBounds,
    }
    const postedMessages: TerrainGenerationResponse[] = []
    const postedTransfers: Transferable[][] = []
    let messageListener = (_event: MessageEvent<TerrainGenerationRequest>): void => {
      throw new Error("Missing worker message listener")
    }
    const scope = {
      addEventListener: vi.fn(
        (_type: "message", listener: (event: MessageEvent<TerrainGenerationRequest>) => void) => {
          messageListener = listener
        },
      ),
      postMessage: vi.fn((message: TerrainGenerationResponse, transfer: Transferable[]) => {
        postedMessages.push(message)
        postedTransfers.push(transfer)
      }),
    }

    const response = generateTerrainChunkResponse(request)

    expect(response.requestId).toBe(7)
    expect(response.key).toBe("chunk_1_-1")
    expect(response.heights).toBeInstanceOf(Float32Array)
    expect(response.terrainMaterials).toBeInstanceOf(Uint8Array)

    initializeTerrainWorker(scope)
    messageListener(new MessageEvent("message", { data: request }))

    expect(scope.addEventListener).toHaveBeenCalledOnce()
    expect(postedMessages[0]?.requestId).toBe(7)
    expect(postedTransfers[0]).toHaveLength(2)
  })

  it("uses a terrain worker client and falls back when workers are unavailable", async () => {
    const worker = new FakeTerrainWorker()
    const client = new TerrainGeneratorWorkerClient(
      {
        seed: 1337,
        chunkSizeMeters: 8,
        resolution: 2,
        worldBounds: defaultGameConfig.worldBounds,
      },
      () => worker,
    )

    expect(client.getDebugStats()).toEqual({
      workerAvailable: false,
      pendingRequestCount: 0,
      completedWorkerRequestCount: 0,
      fallbackGenerationCount: 0,
      workerErrorCount: 0,
      lastWorkerErrorMessage: null,
      lastGenerationMilliseconds: null,
      averageGenerationMilliseconds: null,
    })

    const firstChunk = await client.generateChunk(new ChunkCoord(0, 0))
    worker.emit(
      generateTerrainChunkResponse({
        requestId: 999,
        seed: 1337,
        chunkX: 99,
        chunkZ: 99,
        chunkSizeMeters: 8,
        resolution: 2,
        worldBounds: defaultGameConfig.worldBounds,
      }),
    )
    const secondChunk = await client.generateChunk(new ChunkCoord(1, 0))

    expect(firstChunk.key).toBe("chunk_0_0")
    expect(secondChunk.key).toBe("chunk_1_0")
    expect(worker.postedRequests).toHaveLength(2)
    expect(client.getDebugStats().workerAvailable).toBe(true)
    expect(client.getDebugStats().completedWorkerRequestCount).toBe(2)
    expect(client.getDebugStats().averageGenerationMilliseconds).toBeTypeOf("number")

    client.dispose()
    expect(worker.terminated).toBe(true)
    worker.emit(
      generateTerrainChunkResponse({
        requestId: 1,
        seed: 1337,
        chunkX: 0,
        chunkZ: 0,
        chunkSizeMeters: 8,
        resolution: 2,
        worldBounds: defaultGameConfig.worldBounds,
      }),
    )

    const fallbackClient = new TerrainGeneratorWorkerClient(
      {
        seed: 1337,
        chunkSizeMeters: 8,
        resolution: 2,
        worldBounds: defaultGameConfig.worldBounds,
      },
      () => {
        throw new Error("Workers unavailable")
      },
    )
    const fallbackChunk = await fallbackClient.generateChunk(new ChunkCoord(2, 0))

    expect(fallbackChunk.key).toBe("chunk_2_0")
    expect(fallbackClient.getDebugStats().fallbackGenerationCount).toBe(1)
    fallbackClient.dispose()
  })

  it("falls back pending terrain worker requests after worker errors", async () => {
    const worker = new FakeTerrainWorker(false)
    const client = new TerrainGeneratorWorkerClient(
      {
        seed: 1337,
        chunkSizeMeters: 8,
        resolution: 2,
        worldBounds: defaultGameConfig.worldBounds,
      },
      () => worker,
    )
    const pending = client.generateChunk(new ChunkCoord(0, 0))

    worker.emitError("terrain worker failed")
    const chunk = await pending

    expect(chunk.key).toBe("chunk_0_0")
    expect(worker.terminated).toBe(true)
    expect(client.getDebugStats().workerErrorCount).toBe(1)
    expect(client.getDebugStats().lastWorkerErrorMessage).toBe("terrain worker failed")
    expect(client.getDebugStats().fallbackGenerationCount).toBe(1)

    client.dispose()
  })

  it("falls back when posting terrain worker requests fails", async () => {
    const client = new TerrainGeneratorWorkerClient(
      {
        seed: 1337,
        chunkSizeMeters: 8,
        resolution: 2,
        worldBounds: defaultGameConfig.worldBounds,
      },
      () => new ThrowingTerrainWorker(),
    )
    const chunk = await client.generateChunk(new ChunkCoord(0, 0))

    expect(chunk.key).toBe("chunk_0_0")
    expect(client.getDebugStats().workerErrorCount).toBe(1)
    expect(client.getDebugStats().lastWorkerErrorMessage).toBe("post failed")
    expect(client.getDebugStats().fallbackGenerationCount).toBe(1)

    client.dispose()
  })

  it("rejects pending terrain worker requests on dispose", async () => {
    const worker = new FakeTerrainWorker(false)
    const client = new TerrainGeneratorWorkerClient(
      {
        seed: 1337,
        chunkSizeMeters: 8,
        resolution: 2,
        worldBounds: defaultGameConfig.worldBounds,
      },
      () => worker,
    )
    const pending = client.generateChunk(new ChunkCoord(0, 0))

    client.dispose()

    await expect(pending).rejects.toThrow("Terrain worker disposed.")
    expect(worker.terminated).toBe(true)
  })

  it("builds and disposes terrain chunk meshes and supported props", () => {
    const context = createContext()
    const material = {
      terrain: [
        { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
        { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
        { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
        { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
      ],
      trunk: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
      deadWood: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
      needles: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
      pineFoliage: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
      pineNeedleLitter: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
      rock: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
      water: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as unknown,
    }
    const fakeWorldFeatures = {
      getLakesIntersectingBounds: () => [
        {
          id: "test_lake",
          centerX: 1,
          centerZ: 1,
          radiusX: 10,
          radiusZ: 10,
          waterLevelMeters: 0.5,
          depthMeters: 2,
          shoreFalloffMeters: 4,
        },
      ],
      getRiversIntersectingBounds: () => [
        {
          id: "test_river",
          points: [
            [-1, 1],
            [3, 1],
          ],
          widthMeters: 1,
          depthMeters: 1,
          bankFalloffMeters: 1,
          waterLevelMeters: 0.25,
        },
      ],
      sample: () => ({
        water: {
          feature: { id: "test_river" },
          type: "river",
          isUnderWater: true,
        },
      }),
    }
    const chunk = new TerrainChunk(
      context,
      createSmallChunkData(),
      material,
      fakeWorldFeatures as unknown,
    )
    const sparseChunk = new TerrainChunk(
      context,
      {
        ...createSmallChunkData(),
        key: "chunk_sparse",
        heights: new Float32Array([]),
        terrainMaterials: new Uint8Array([]),
      },
      material,
    )

    expect(chunk.key).toBe("chunk_0_0")
    expect(((chunk as unknown)._terrainMesh.vertexData.colors as number[]).length).toBe(16)
    expect((chunk as unknown)._sampleChunkHeight(1, 1)).toBeTypeOf("number")
    expect((sparseChunk as unknown)._sampleChunkHeight(1, 1)).toBe(0)
    chunk.dispose()
    sparseChunk.dispose()
  })
})

describe("data repositories", () => {
  it("saves and loads world config through localForage", async () => {
    const repository = new LocalForageSaveGameRepository()

    expect(await repository.getWorldConfig()).toBeNull()

    await repository.saveWorldConfig({ worldId: "world_test", worldSeed: 42 })
    expect(await repository.getWorldConfig()).toEqual({ worldId: "world_test", worldSeed: 42 })

    const saveGame = {
      version: 1,
      savedAt: 123,
      worldId: "world_test",
      worldSeed: 42,
      player: { position: [1, 2, 3] as const, headingDegrees: 90 },
      world: { day: 2, timeOfDayHours: 10, elapsedWorldSeconds: 20 },
    }

    expect(await repository.getSaveGame()).toBeNull()
    await repository.saveGame(saveGame)
    expect(await repository.getSaveGame()).toEqual(saveGame)
  })

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
    const manager = new ChunkManager(context, generator, repository, createWorldFeatures(), {
      loadRadiusChunks: 0,
      unloadRadiusChunks: 0,
      memoryRadiusChunks: 0,
    })

    expect(manager.getDebugStats().maxChunkLoadsPerFrame).toBeNull()

    await manager.updateAround(new ChunkCoord(0, 0))
    await manager.updateAround(new ChunkCoord(0, 0))
    expect(repository.savedKeys).toContain("chunk_0_0")
    expect(manager.getHeightAt(1, 1)).toBeTypeOf("number")
    expect(manager.chunkBoundariesDebugEnabled).toBe(false)

    manager.setChunkBoundariesDebugEnabled(true)
    expect(manager.chunkBoundariesDebugEnabled).toBe(true)
    expect((manager as unknown)._chunkBoundaryMeshes.size).toBe(1)
    manager.setChunkBoundariesDebugEnabled(false)
    expect((manager as unknown)._chunkBoundaryMeshes.size).toBe(0)

    ;(manager as unknown)._activeChunks.clear()
    await manager.updateAround(new ChunkCoord(0, 0))
    expect(
      (manager as unknown)._sampleChunkHeight(
        { ...createSmallChunkData(), heights: new Float32Array([]) },
        1,
        1,
      ),
    ).toBe(0)
    ;(manager as unknown)._activeChunks.clear()
    ;(manager as unknown)._evictDistantCachedData(new ChunkCoord(0, 0))

    ;(manager as unknown)._activeCoords.delete("chunk_0_0")
    await manager.updateAround(new ChunkCoord(1, 0))
    await manager.updateAround(new ChunkCoord(0, 0))
    expect(manager.getHeightAt(1000, 1000)).toBeTypeOf("number")

    manager.dispose()
  })

  it("processes terrain streaming with a per-frame chunk budget", async () => {
    const context = createContext()
    const repository = new MemoryChunkRepository()
    const generator = new TerrainGenerator({ seed: 1337, chunkSizeMeters: 8, resolution: 2 })
    const manager = new ChunkManager(context, generator, repository, createWorldFeatures(), {
      loadRadiusChunks: 1,
      unloadRadiusChunks: 1,
      memoryRadiusChunks: 1,
      maxChunkLoadsPerFrame: 1,
    })

    expect(manager.getDebugStats()).toEqual({
      activeChunkCount: 0,
      queuedChunkCount: 0,
      inFlightChunkCount: 0,
      cachedChunkDataCount: 0,
      maxChunkLoadsPerFrame: 1,
      terrainGeneration: null,
      terrainMeshBuild: {
        builtChunkCount: 0,
        lastBuildMilliseconds: null,
        averageBuildMilliseconds: null,
      },
    })

    await manager.updateStreaming(new ChunkCoord(0, 0))
    expect(repository.savedKeys).toHaveLength(1)
    expect(manager.hasPendingWork).toBe(true)
    expect(manager.getDebugStats().activeChunkCount).toBe(1)
    expect(manager.getDebugStats().queuedChunkCount).toBe(8)

    await manager.updateStreaming(new ChunkCoord(5, 5))
    expect(repository.savedKeys).toHaveLength(2)

    await manager.updateStreaming(new ChunkCoord(0, 0))
    expect(repository.savedKeys).toHaveLength(3)

    await (manager as unknown)._ensureChunk(new ChunkCoord(0, 0))
    ;(manager as unknown)._inFlightLoads.add("chunk_9_9")
    await (manager as unknown)._ensureChunk(new ChunkCoord(9, 9))
    expect(repository.savedKeys).toHaveLength(3)
    ;(manager as unknown)._inFlightLoads.clear()

    await manager.updateAround(new ChunkCoord(0, 0))
    expect(manager.hasPendingWork).toBe(false)
    expect(repository.savedKeys.length).toBeGreaterThanOrEqual(10)

    manager.dispose()
  })

  it("enforces at least one terrain chunk load per streaming update", async () => {
    const context = createContext()
    const repository = new MemoryChunkRepository()
    const generator = new TerrainGenerator({ seed: 1337, chunkSizeMeters: 8, resolution: 2 })
    const manager = new ChunkManager(context, generator, repository, createWorldFeatures(), {
      loadRadiusChunks: 0,
      unloadRadiusChunks: 1,
      memoryRadiusChunks: 1,
      maxChunkLoadsPerFrame: 0,
    })

    await manager.updateStreaming(new ChunkCoord(0, 0))
    expect(repository.savedKeys).toEqual(["chunk_0_0"])

    manager.dispose()
  })

  it("scopes persisted chunk keys by world id", async () => {
    const context = createContext()
    const repository = new MemoryChunkRepository()
    const generator = new TerrainGenerator({ seed: 1337, chunkSizeMeters: 8, resolution: 2 })
    const manager = new ChunkManager(context, generator, repository, createWorldFeatures(), {
      loadRadiusChunks: 0,
      unloadRadiusChunks: 1,
      memoryRadiusChunks: 1,
      worldId: "world_a",
    })

    await manager.updateAround(new ChunkCoord(0, 0))

    expect(repository.savedKeys).toEqual(["world_a:chunk_0_0"])
    expect(repository.items.get("world_a:chunk_0_0")?.worldSeed).toBe(1337)

    manager.dispose()
  })

  it("filters desired chunks outside finite world bounds", async () => {
    const context = createContext()
    const repository = new MemoryChunkRepository()
    const generator = new TerrainGenerator({ seed: 1337, chunkSizeMeters: 8, resolution: 2 })
    const manager = new ChunkManager(context, generator, repository, createWorldFeatures(), {
      loadRadiusChunks: 1,
      unloadRadiusChunks: 1,
      memoryRadiusChunks: 1,
      worldBounds: { minX: 0, maxX: 7.9, minZ: 0, maxZ: 7.9 },
    })

    await manager.updateAround(new ChunkCoord(0, 0))

    expect(repository.savedKeys).toEqual(["chunk_0_0"])

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
    const manager = new ChunkManager(context, generator, repository, createWorldFeatures(), {
      loadRadiusChunks: 0,
      unloadRadiusChunks: 1,
      memoryRadiusChunks: 1,
    })

    await manager.updateAround(new ChunkCoord(0, 0))
    expect(repository.items.get("chunk_0_0")?.lastVisitedAt).toBeGreaterThan(0)
    const legacyChunk = (manager as unknown)._fromPersistedChunk(
      createPersistedChunk("chunk_sparse_mutation", {
        heights: [],
        mutations: [{ type: "terrainDelta", vertexIndex: 99, deltaY: 2 }],
        terrainMaterials: undefined,
      }),
    )

    expect(legacyChunk.heights[99]).toBeUndefined()
    expect(legacyChunk.terrainMaterials.length).toBe(9)

    manager.dispose()
  })

  it("regenerates incompatible chunks and tolerates repository failures", async () => {
    const context = createContext()
    const repository = new MemoryChunkRepository()
    repository.items.set("chunk_0_0", createPersistedChunk("chunk_0_0", { worldSeed: 999 }))
    repository.failLoad = true
    repository.failSave = true

    const generator = new TerrainGenerator({ seed: 1337, chunkSizeMeters: 8, resolution: 2 })
    const manager = new ChunkManager(context, generator, repository, createWorldFeatures(), {
      loadRadiusChunks: 0,
      unloadRadiusChunks: 1,
      memoryRadiusChunks: 1,
    })

    expect(
      (manager as unknown)._isCompatiblePersistedChunk(
        createPersistedChunk("chunk_wrong_size", { chunkSizeMeters: 16 }),
      ),
    ).toBe(false)
    expect(
      (manager as unknown)._isCompatiblePersistedChunk(
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
    const terrain = new ProgressiveTerrainSystem(
      context,
      player,
      new MemoryChunkRepository(),
      createWorldFeatures(),
    )

    await terrain.initialize()
    expect(terrain.getHeightAt(0, 0)).toBeTypeOf("number")
    expect(terrain.getStreamingDebugStats().maxChunkLoadsPerFrame).toBe(1)
    expect(terrain.chunkBoundariesDebugEnabled).toBe(false)
    terrain.setChunkBoundariesDebugEnabled(true)
    expect(terrain.chunkBoundariesDebugEnabled).toBe(true)

    ;(terrain as unknown)._isRefreshing = true
    await (terrain as unknown)._refreshChunks()
    ;(terrain as unknown)._isRefreshing = false

    terrain.update(0.016)
    ;(terrain as unknown)._chunkManager._queuedCoords.clear()
    ;(terrain as unknown)._chunkManager._inFlightLoads.clear()
    terrain.update(0.016)
    ;(terrain as unknown)._targetCenter = null
    ;(terrain as unknown)._isRefreshing = false
    await (terrain as unknown)._refreshChunks()
    ;(terrain as unknown)._isRefreshing = true
    ;(player as unknown)._camera.position.x = 500
    terrain.update(0.016)
    ;(terrain as unknown)._isRefreshing = false
    ;(player as unknown)._camera.position.x = 1000
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
    await expect(import("../src/main")).rejects.toThrow("Missing #ui-root element.")
  })

  it("wires options UI and shutdown", async () => {
    vi.resetModules()
    document.body.innerHTML = `
      <canvas id="game-canvas"></canvas>
      <div id="ui-root"></div>
    `

    await import("../src/main")

    const optionsButton = document.querySelector<HTMLButtonElement>("#options-button")
    const optionsPanel = document.querySelector<HTMLElement>("#options-panel")
    const invertMouseInput = document.querySelector<HTMLInputElement>("#invert-mouse-y")
    const saveGameButton = document.querySelector<HTMLButtonElement>("#save-game-button")
    const saveGameStatus = document.querySelector<HTMLElement>("#save-game-status")

    optionsButton?.click()
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(optionsPanel?.hidden).toBe(false)

    invertMouseInput!.checked = true
    invertMouseInput?.dispatchEvent(new Event("change", { bubbles: true }))
    expect(loadGameSettings()).toEqual({ invertMouseY: true })

    saveGameButton?.click()
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(saveGameStatus?.textContent).toBe("Game saved.")

    window.dispatchEvent(new Event("beforeunload"))
  })
})

describe("game runtime", () => {
  it("starts, renders, updates settings, resizes, and disposes", async () => {
    const { Game } = await import("../src/app/Game")
    const canvas = document.createElement("canvas")
    const reloadWindow = vi.fn()
    const saveGameRepository = new LocalForageSaveGameRepository()
    const gameWithoutRepository = new Game(document.createElement("canvas"))

    await gameWithoutRepository.saveGame()

    await saveGameRepository.saveGame({
      version: 1,
      savedAt: 1,
      worldId: "other_world",
      worldSeed: defaultGameConfig.worldSeed,
      player: { position: [99, 99, 99], headingDegrees: 90 },
      world: { day: 9, timeOfDayHours: 9, elapsedWorldSeconds: 9 },
    })

    const incompatibleSaveGame = new Game(
      document.createElement("canvas"),
      defaultGameConfig,
      defaultGameSettings,
      reloadWindow,
      saveGameRepository,
    )

    await incompatibleSaveGame.start()
    incompatibleSaveGame.dispose()

    await saveGameRepository.saveGame({
      version: 1,
      savedAt: 1,
      worldId: defaultGameConfig.worldId,
      worldSeed: defaultGameConfig.worldSeed,
      player: { position: [12, 13, 14], headingDegrees: 180 },
      world: { day: 4, timeOfDayHours: 6.5, elapsedWorldSeconds: 1234 },
    })

    const game = new Game(
      canvas,
      defaultGameConfig,
      defaultGameSettings,
      reloadWindow,
      saveGameRepository,
    )

    await game.start()
    game.updateSettings({ invertMouseY: true })
    await game.saveGame()

    const savedGame = await saveGameRepository.getSaveGame()

    expect(savedGame?.player.position).toEqual([12, 13, 14])
    expect(savedGame?.player.headingDegrees).toBe(0)
    expect(savedGame?.world.day).toBe(4)
    expect(savedGame?.world.timeOfDayHours).toBe(6.5)
    expect(savedGame?.world.elapsedWorldSeconds).toBe(1234)

    expect(window.stick?.debug.visible()).toBe(false)
    window.stick?.debug.show(true)
    expect(window.stick?.debug.visible()).toBe(true)
    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[1]
      ?.click()
    expect(document.querySelector("#debug-world-map-modal")).toBeTruthy()
    document
      .querySelector("#debug-world-map-modal")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    document.querySelector<HTMLInputElement>("input[name='chunkBoundaries']")!.checked = true
    document
      .querySelector<HTMLFormElement>("#debug-overlay-editor")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }))
    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    expect(document.querySelector<HTMLInputElement>("input[name='chunkBoundaries']")!.checked).toBe(
      true,
    )
    vi.spyOn(window, "confirm").mockReturnValueOnce(true)
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[2]
      ?.click()
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(reloadWindow).toHaveBeenCalledOnce()

    vi.spyOn(window, "confirm").mockReturnValueOnce(true)
    document.querySelector<HTMLInputElement>("input[name='worldSeed']")!.value = "2024"
    document
      .querySelector<HTMLFormElement>("#debug-overlay-editor")
      ?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }))
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(await saveGameRepository.getWorldConfig()).toEqual({
      worldId: "world_2024",
      worldSeed: 2024,
    })

    vi.spyOn(Math, "random").mockReturnValueOnce(0.5)
    vi.spyOn(window, "confirm").mockReturnValueOnce(true)
    document
      .querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[3]
      ?.click()
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    const newWorldConfig = await saveGameRepository.getWorldConfig()

    expect(newWorldConfig?.worldId.startsWith("world_1000000000_")).toBe(true)
    expect(newWorldConfig?.worldSeed).toBe(1_000_000_000)

    document.querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button")[1]?.click()
    window.dispatchEvent(new Event("resize"))
    ;((game as unknown)._context.engine.renderLoop as () => void)()
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("chunks: active")
    game.dispose()

    expect((game as unknown)._context).toBeNull()
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
    terrainMaterials: [0, 1, 2, 3, 0, 1, 2, 3, 0],
    props: [],
    mutations: [],
    generatedAt: 1,
    lastVisitedAt: 1,
    ...overrides,
  }
}

function createTestFlashlightUseAction(message = "Test flashlight action."): {
  readonly toggle: ReturnType<
    typeof vi.fn<() => { readonly enabled: boolean; readonly message: string }>
  >
} {
  return {
    toggle: vi.fn(() => ({ enabled: true, message })),
  }
}

class TestFoundItem implements Item {
  public readonly id = "found_test_item"
  public readonly name = "Found test item"
  public readonly description = "A test item found in the world."
  public readonly source = "found"
  public readonly discardable = true

  public use(): ItemUseResult {
    return { success: true, message: "You use the found test item." }
  }
}

class FakeTerrainWorker {
  public readonly postedRequests: TerrainGenerationRequest[] = []
  public terminated = false
  private _errorListener: ((event: ErrorEvent) => void) | null = null
  private _listener: ((event: MessageEvent<TerrainGenerationResponse>) => void) | null = null

  public constructor(private readonly _autoRespond = true) {}

  public postMessage(message: TerrainGenerationRequest): void {
    this.postedRequests.push(message)

    if (this._autoRespond) {
      this.emit(generateTerrainChunkResponse(message))
    }
  }

  public addEventListener(
    type: "message" | "error",
    listener:
      ((event: MessageEvent<TerrainGenerationResponse>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === "message") {
      this._listener = listener as (event: MessageEvent<TerrainGenerationResponse>) => void
      return
    }

    this._errorListener = listener as (event: ErrorEvent) => void
  }

  public removeEventListener(
    type: "message" | "error",
    listener:
      ((event: MessageEvent<TerrainGenerationResponse>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === "message" && this._listener === listener) {
      this._listener = null
      return
    }

    if (type === "error" && this._errorListener === listener) {
      this._errorListener = null
    }
  }

  public terminate(): void {
    this.terminated = true
  }

  public emit(response: TerrainGenerationResponse): void {
    this._listener?.(new MessageEvent("message", { data: response }))
  }

  public emitError(message: string): void {
    this._errorListener?.(new ErrorEvent("error", { message }))
  }
}

class ThrowingTerrainWorker extends FakeTerrainWorker {
  public override postMessage(_message: TerrainGenerationRequest): void {
    throw new Error("post failed")
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
