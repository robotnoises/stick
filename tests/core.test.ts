import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { defaultGameConfig } from "../src/app/GameConfig"
import { EngineContext } from "../src/app/EngineContext"
import { defaultGameSettings, loadGameSettings, saveGameSettings } from "../src/app/GameSettings"
import { DebugOverlay } from "../src/debug/DebugOverlay"
import { BabylonBootstrap } from "../src/engine/BabylonBootstrap"
import { LightingController } from "../src/environment/LightingController"
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
import { ProgressiveTerrainSystem } from "../src/world/ProgressiveTerrainSystem"
import { TerrainChunk } from "../src/world/TerrainChunk"
import { TerrainMaterial, type ChunkTerrainData } from "../src/world/TerrainTypes"
import { WorldBoundsHelper } from "../src/world/WorldBounds"
import { TerrainGenerator } from "../src/world/generation/TerrainGenerator"
import { WorldFeatureGenerator } from "../src/world/generation/WorldFeatureGenerator"
import { LocalForageChunkRepository } from "../src/data/LocalForageChunkRepository"
import type { ChunkRepository, PersistedChunkData } from "../src/data/ChunkRepository"
import { TestTerrainSystem } from "../src/world/TestTerrainSystem"

const FakeColor3 = (globalThis as any).FakeColor3
const FakeColor4 = (globalThis as any).FakeColor4
const FakePointLight = (globalThis as any).FakePointLight
const FakeSpotLight = (globalThis as any).FakeSpotLight
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

    player.setPosition(2, 3, 4)
    expect(player.position).toEqual(new FakeVector3(2, 3, 4))

    player.setHeadingDegrees(-90)
    expect((context.scene.activeCamera as any).rotation.y).toBeCloseTo((270 * Math.PI) / 180)

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
      setPosition: vi.fn((x: number, y: number, z: number) => {
        player.position = new FakeVector3(x, y, z)
      }),
      setHeadingDegrees: vi.fn((heading: number) => {
        player.headingDegrees = heading
      }),
    }
    const time = new TimeOfDaySystem(8.5, 1)
    const resetWorld = vi.fn()
    const overlay = new DebugOverlay(player as any, time, {
      getDebugMapData: () => ({
        worldBounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 },
        playerPosition: { x: 100, z: -200 },
        lakes: [
          {
            id: "debug_lake",
            centerX: 200,
            centerZ: 100,
            radiusX: 150,
            radiusZ: 90,
          },
        ],
      }),
      resetWorld,
    })

    overlay.update(0.016)
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("elevation: 2.9m")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("heading: 123°")
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("day: 1")

    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    overlay.update(0.016)
    expect(document.querySelector("#debug-overlay-editor")).toBeTruthy()
    expect(document.querySelector<HTMLFormElement>("#debug-overlay-editor")?.noValidate).toBe(true)
    expect(document.querySelector<HTMLInputElement>("input[name='positionX']")?.step).toBe("any")

    document.querySelector<HTMLButtonElement>("#debug-overlay-editor button[type='button']")?.click()
    expect(document.querySelector("#debug-overlay-editor")).toBeNull()

    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    document.querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[1]?.click()
    let debugMapSvg = document.querySelector<SVGSVGElement>("#debug-world-map-modal svg")!

    expect(debugMapSvg.getAttribute("role")).toBe("img")
    expect(document.querySelectorAll("#debug-world-map-modal .debug-map-lake").length).toBe(1)
    document.querySelectorAll<HTMLButtonElement>("#debug-world-map-panel button")[1]?.click()
    expect(document.querySelector("#debug-world-map-modal")).toBeNull()
    document.querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[1]?.click()
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
    document.querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[2]?.click()
    expect(resetWorld).not.toHaveBeenCalled()

    vi.spyOn(window, "confirm").mockReturnValueOnce(true)
    document.querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[2]?.click()
    expect(resetWorld).toHaveBeenCalledOnce()

    ;(document.querySelector<HTMLInputElement>("input[name='positionX']")!.value = "10")
    ;(document.querySelector<HTMLInputElement>("input[name='positionY']")!.value = "11")
    ;(document.querySelector<HTMLInputElement>("input[name='positionZ']")!.value = "12")
    ;(document.querySelector<HTMLInputElement>("input[name='heading']")!.value = "270")
    ;(document.querySelector<HTMLInputElement>("input[name='day']")!.value = "3")
    ;(document.querySelector<HTMLInputElement>("input[name='timeOfDay']")!.value = "21.5")
    ;(overlay as any)._readNumber(
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
    expect(document.querySelector("#debug-overlay")?.textContent).toContain("time: 21.50h")

    overlay.dispose()
    expect(document.querySelector("#debug-overlay")).toBeNull()

    const overlayWithoutActions = new DebugOverlay(player as any, time)

    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    document.querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[1]?.click()
    document.querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[2]?.click()
    overlayWithoutActions.dispose()
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
    const flashlight = new FlashlightController(context, player as any)

    expect((flashlight as any)._light).toBeInstanceOf(FakeSpotLight)
    expect((flashlight as any)._spillLight).toBeInstanceOf(FakeSpotLight)
    expect((flashlight as any)._fillLight).toBeInstanceOf(FakePointLight)
    expect((flashlight as any)._spillLight.angle).toBeGreaterThan((flashlight as any)._light.angle)
    expect(flashlight.enabled).toBe(false)
    expect((flashlight as any)._light.intensity).toBe(0)
    expect((flashlight as any)._spillLight.intensity).toBe(0)
    expect((flashlight as any)._fillLight.intensity).toBe(0)

    expect(flashlight.toggle()).toEqual({ enabled: true, message: "Solar flashlight on." })
    expect(flashlight.enabled).toBe(true)
    expect((flashlight as any)._light.intensity).toBeGreaterThan(0)
    expect((flashlight as any)._spillLight.intensity).toBeGreaterThan(0)
    expect((flashlight as any)._spillLight.intensity).toBeLessThan(
      (flashlight as any)._light.intensity,
    )
    expect((flashlight as any)._fillLight.intensity).toBeGreaterThan(0)
    expect((flashlight as any)._light.position).toEqual(new FakeVector3(5, 6, 7.35))
    expect((flashlight as any)._spillLight.position).toEqual(new FakeVector3(5, 6, 7.35))
    expect((flashlight as any)._fillLight.position).toEqual(new FakeVector3(5, 6, 12.35))
    expect((flashlight as any)._light.direction).toEqual(new FakeVector3(0, 0, 1))
    expect((flashlight as any)._spillLight.direction).toEqual(new FakeVector3(0, 0, 1))

    player.position = new FakeVector3(1, 2, 3)
    player.forwardDirection = new FakeVector3(2, 0, 0)
    flashlight.update(0.016)
    expect((flashlight as any)._light.position).toEqual(new FakeVector3(1.35, 2, 3))
    expect((flashlight as any)._spillLight.position).toEqual(new FakeVector3(1.35, 2, 3))
    expect((flashlight as any)._fillLight.position).toEqual(new FakeVector3(6.35, 2, 3))
    expect((flashlight as any)._light.direction).toEqual(new FakeVector3(1, 0, 0))
    expect((flashlight as any)._spillLight.direction).toEqual(new FakeVector3(1, 0, 0))

    flashlight.setEnabled(false)
    expect((flashlight as any)._spillLight.intensity).toBe(0)
    expect((flashlight as any)._fillLight.intensity).toBe(0)
    expect(flashlight.toggle()).toEqual({ enabled: true, message: "Solar flashlight on." })
    expect(flashlight.toggle()).toEqual({ enabled: false, message: "Solar flashlight off." })

    flashlight.dispose()
    expect((flashlight as any)._light.disposed).toBe(true)
    expect((flashlight as any)._spillLight.disposed).toBe(true)
    expect((flashlight as any)._fillLight.disposed).toBe(true)
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
    document.querySelector<HTMLButtonElement>("button[data-item-id='core_flint_and_steel']")?.click()
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

    expect((lighting as any)._sun.intensity).toBe(0)
    expect((lighting as any)._moon.intensity).toBeGreaterThan(0)
    expect((lighting as any)._moon.intensity).toBeLessThan(0.3)
    expect((lighting as any)._ambient.intensity).toBeGreaterThan(0.08)

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
    expect(a.getLakesIntersectingBounds(bounds).length).toBeGreaterThan(0)
    expect(
      a.getLakesIntersectingBounds({ minX: 100_000, maxX: 101_000, minZ: 100_000, maxZ: 101_000 }),
    ).toEqual([])
    ;(a as any)._lakes = [
      { ...lake, id: "wide", centerX: 0, centerZ: 0, radiusX: 100, radiusZ: 100 },
      { ...lake, id: "equal", centerX: 0, centerZ: 0, radiusX: 100, radiusZ: 100 },
    ]
    expect(a.sample(0, 0).water?.feature.id).toBe("wide")
    ;(a as any)._lakes = [
      { ...lake, id: "near", centerX: 0, centerZ: 0, radiusX: 10, radiusZ: 10 },
      { ...lake, id: "closer", centerX: 5, centerZ: 0, radiusX: 100, radiusZ: 100 },
    ]
    expect(a.sample(5, 0).water?.feature.id).toBe("closer")
    ;(a as any)._lakes.length = 0
    expect(a.lakes.length).toBe(0)
    expect(a.sample(0, 0)).toEqual({ water: null })
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
    let foundDirt = false

    for (let z = 0; z < 20 && !foundDirt; z += 1) {
      for (let x = 0; x < 20 && !foundDirt; x += 1) {
        foundDirt = generator.getTerrainMaterial(x * 13, z * 13, 0) === TerrainMaterial.Dirt
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

    expect(foundDirt).toBe(true)
    expect(lakeCenterHeight).toBeLessThanOrEqual(lake.waterLevelMeters)
    expect(shoreMaterial).toBe(TerrainMaterial.Sand)
    expect(lakeProps.every((prop) => prop.position[1] > lake.waterLevelMeters - lake.depthMeters)).toBe(
      true,
    )
    expect(generator.getHeight(1.5, 2.5)).toBe(generator.getHeight(1.5, 2.5))
    expect(generator.getTerrainMaterial(1.5, 2.5)).toBe(generator.getTerrainMaterial(1.5, 2.5))
  })

  it("builds and disposes terrain chunk meshes and supported props", () => {
    const context = createContext()
    const material = {
      terrain: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as any,
      trunk: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as any,
      needles: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as any,
      rock: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as any,
      water: { diffuseColor: new FakeColor3(), dispose: vi.fn() } as any,
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
    }
    const chunk = new TerrainChunk(context, createSmallChunkData(), material, fakeWorldFeatures as any)
    const sparseChunk = new TerrainChunk(
      context,
      {
        ...createSmallChunkData(),
        key: "chunk_sparse",
        heights: new Float32Array([0]),
        terrainMaterials: new Uint8Array([]),
      },
      material,
    )

    expect(chunk.key).toBe("chunk_0_0")
    expect(((chunk as any)._terrainMesh.vertexData.colors as number[]).length).toBe(16)
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
    const manager = new ChunkManager(context, generator, repository, createWorldFeatures(), {
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
    const legacyChunk = (manager as any)._fromPersistedChunk(
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
    const terrain = new ProgressiveTerrainSystem(
      context,
      player,
      new MemoryChunkRepository(),
      createWorldFeatures(),
    )

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
    const reloadWindow = vi.fn()
    const game = new Game(canvas, defaultGameConfig, defaultGameSettings, reloadWindow)

    await game.start()
    game.updateSettings({ invertMouseY: true })

    document.querySelector<HTMLElement>("#debug-overlay")?.click()
    document.querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[1]?.click()
    expect(document.querySelector("#debug-world-map-modal")).toBeTruthy()
    document.querySelector("#debug-world-map-modal")?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    vi.spyOn(window, "confirm").mockReturnValueOnce(true)
    document.querySelectorAll<HTMLButtonElement>("#debug-overlay-editor button[type='button']")[2]?.click()
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(reloadWindow).toHaveBeenCalledOnce()

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
    terrainMaterials: [0, 1, 2, 3, 0, 1, 2, 3, 0],
    props: [],
    mutations: [],
    generatedAt: 1,
    lastVisitedAt: 1,
    ...overrides,
  }
}

function createTestFlashlightUseAction(message = "Test flashlight action."): {
  readonly toggle: ReturnType<typeof vi.fn<() => { readonly enabled: boolean; readonly message: string }>>
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
