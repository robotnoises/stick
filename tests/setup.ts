import { vi } from "vitest"

class FakeColor3 {
  public constructor(
    public r = 0,
    public g = 0,
    public b = 0,
  ) {}

  public set(r: number, g: number, b: number): void {
    this.r = r
    this.g = g
    this.b = b
  }

  public static Black(): FakeColor3 {
    return new FakeColor3(0, 0, 0)
  }
}

class FakeColor4 {
  public constructor(
    public r = 0,
    public g = 0,
    public b = 0,
    public a = 1,
  ) {}
}

class FakeVector3 {
  public constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}

  public clone(): FakeVector3 {
    return new FakeVector3(this.x, this.y, this.z)
  }

  public set(x: number, y: number, z: number): void {
    this.x = x
    this.y = y
    this.z = z
  }

  public add(other: FakeVector3): FakeVector3 {
    return new FakeVector3(this.x + other.x, this.y + other.y, this.z + other.z)
  }

  public scale(amount: number): FakeVector3 {
    return new FakeVector3(this.x * amount, this.y * amount, this.z * amount)
  }

  public normalize(): FakeVector3 {
    const length = Math.hypot(this.x, this.y, this.z)

    if (length === 0) {
      return new FakeVector3(0, 0, 0)
    }

    return new FakeVector3(this.x / length, this.y / length, this.z / length)
  }

  public static Zero(): FakeVector3 {
    return new FakeVector3(0, 0, 0)
  }
}

class FakeTexture {
  public uScale = 1
  public vScale = 1

  public constructor(
    public readonly url: string,
    public readonly scene: unknown,
  ) {}
}

class FakeMultiMaterial {
  public readonly subMaterials: unknown[] = []

  public constructor(
    public readonly name: string,
    public readonly scene: unknown,
  ) {}
}

class FakeStandardMaterial {
  public diffuseColor = new FakeColor3()
  public specularColor = new FakeColor3()
  public ambientColor = new FakeColor3()
  public emissiveColor = new FakeColor3()
  public alpha = 1
  public disableLighting = false
  public fogEnabled = true
  public backFaceCulling = true
  public twoSidedLighting = false
  public diffuseTexture: unknown = null
  public disposed = false

  public constructor(
    public readonly name: string,
    public readonly scene: unknown,
  ) {}

  public dispose(): void {
    this.disposed = true
  }
}

class FakeMesh {
  public static readonly BILLBOARDMODE_ALL = 7

  public material: unknown = null
  public position = new FakeVector3()
  public rotation = { y: 0 }
  public visibility = 1
  public enabled = true
  public disposed = false
  public vertexData: unknown = null
  public subMeshes: unknown[] = []
  public isPickable = true
  public alwaysSelectAsActiveMesh = false
  public billboardMode = 0

  public constructor(
    public readonly name: string,
    public readonly scene: unknown,
  ) {}

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  public updateVerticesData(kind: string, data: number[]): void {
    if (this.vertexData && typeof this.vertexData === "object") {
      ;(this.vertexData as Record<string, unknown>)[kind] = data
    }
  }

  public dispose(): void {
    this.disposed = true
  }
}

class FakeSubMesh {
  public constructor(
    public readonly materialIndex: number,
    public readonly verticesStart: number,
    public readonly verticesCount: number,
    public readonly indexStart: number,
    public readonly indexCount: number,
    public readonly mesh: FakeMesh,
  ) {
    mesh.subMeshes.push(this)
  }
}

class FakeVertexData {
  public positions: number[] = []
  public indices: number[] = []
  public normals: number[] = []
  public uvs: number[] = []
  public colors: number[] = []

  public applyToMesh(mesh: FakeMesh): void {
    mesh.vertexData = this
  }

  public static ComputeNormals(positions: number[], _indices: number[], normals: number[]): void {
    normals.length = 0

    for (let index = 0; index < positions.length; index += 1) {
      normals.push(index % 3 === 1 ? 1 : 0)
    }
  }
}

class FakeDirectionalLight {
  public intensity = 0
  public disposed = false

  public constructor(
    public readonly name: string,
    public direction: FakeVector3,
    public readonly scene: unknown,
  ) {}

  public dispose(): void {
    this.disposed = true
  }
}

class FakeHemisphericLight extends FakeDirectionalLight {}

class FakePointLight {
  public diffuse = new FakeColor3()
  public specular = new FakeColor3()
  public range = 0
  public intensity = 0
  public disposed = false

  public constructor(
    public readonly name: string,
    public position: FakeVector3,
    public readonly scene: unknown,
  ) {}

  public dispose(): void {
    this.disposed = true
  }
}

class FakeSpotLight extends FakeDirectionalLight {
  public diffuse = new FakeColor3()
  public specular = new FakeColor3()
  public range = 0

  public constructor(
    name: string,
    public position: FakeVector3,
    direction: FakeVector3,
    public readonly angle: number,
    public readonly exponent: number,
    scene: unknown,
  ) {
    super(name, direction, scene)
  }
}

class FakeUniversalCamera {
  public minZ = 0
  public speed = 0
  public angularSensibility = 0
  public keysUp: number[] = []
  public keysDown: number[] = []
  public keysLeft: number[] = []
  public keysRight: number[] = []
  public position: FakeVector3
  public rotation = new FakeVector3()
  public attachedCanvas: HTMLCanvasElement | null = null
  public movement = {
    input: {
      getEntries: vi.fn(() => [{ sensitivityX: 0, sensitivityY: 0 }]),
    },
  }

  public constructor(
    public readonly name: string,
    position: FakeVector3,
    public readonly scene: FakeScene,
  ) {
    this.position = position
  }

  public attachControl(canvas: HTMLCanvasElement): void {
    this.attachedCanvas = canvas
  }

  public detachControl(): void {
    this.attachedCanvas = null
  }

  public getForwardRay(): { direction: FakeVector3 } {
    return { direction: new FakeVector3(0, 0, 1) }
  }
}

class FakeEngine {
  public disposed = false
  public resized = false
  public renderLoop: (() => void) | null = null

  public constructor(
    public readonly canvas: HTMLCanvasElement,
    public readonly antialiasOrOptions?: unknown,
    public readonly options?: unknown,
  ) {}

  public runRenderLoop(callback: () => void): void {
    this.renderLoop = callback
  }

  public resize(): void {
    this.resized = true
  }

  public dispose(): void {
    this.disposed = true
  }
}

class FakeWebGPUEngine extends FakeEngine {
  public static IsSupportedAsync: Promise<boolean> = Promise.resolve(false)
  public initialized = false

  public async initAsync(): Promise<void> {
    this.initialized = true
  }
}

class FakeGlowLayer {
  public intensity = 0
  public disposed = false
  public readonly includedMeshes: FakeMesh[] = []

  public constructor(
    public readonly name: string,
    public readonly scene: unknown,
  ) {}

  public addIncludedOnlyMesh(mesh: FakeMesh): void {
    this.includedMeshes.push(mesh)
  }

  public dispose(): void {
    this.disposed = true
  }
}

class FakeScene {
  public static readonly FOGMODE_LINEAR = 3

  public clearColor = new FakeColor4()
  public fogColor = new FakeColor3()
  public fogMode = 0
  public fogStart = 0
  public fogEnd = 0
  public activeCamera: unknown = null
  public rendered = false

  public constructor(public readonly engine: unknown) {}

  public render(): void {
    this.rendered = true
  }
}

const createMesh = (name: string, _options: unknown, scene: unknown): FakeMesh =>
  new FakeMesh(name, scene)

vi.mock("@babylonjs/core/Maths/math.color", () => ({
  Color3: FakeColor3,
  Color4: FakeColor4,
}))

vi.mock("@babylonjs/core/Maths/math.vector", () => ({ Vector3: FakeVector3 }))
vi.mock("@babylonjs/core/Materials/Textures/texture", () => ({ Texture: FakeTexture }))
vi.mock("@babylonjs/core/Materials/multiMaterial", () => ({ MultiMaterial: FakeMultiMaterial }))
vi.mock("@babylonjs/core/Materials/standardMaterial", () => ({
  StandardMaterial: FakeStandardMaterial,
}))
vi.mock("@babylonjs/core/Meshes/mesh", () => ({ Mesh: FakeMesh }))
vi.mock("@babylonjs/core/Meshes/subMesh", () => ({ SubMesh: FakeSubMesh }))
vi.mock("@babylonjs/core/Meshes/meshBuilder", () => ({
  MeshBuilder: {
    CreateCylinder: createMesh,
    CreateDisc: createMesh,
    CreateGround: createMesh,
    CreateLines: createMesh,
    CreateSphere: createMesh,
  },
}))
vi.mock("@babylonjs/core/Meshes/mesh.vertexData", () => ({ VertexData: FakeVertexData }))
vi.mock("@babylonjs/core/Lights/directionalLight", () => ({
  DirectionalLight: FakeDirectionalLight,
}))
vi.mock("@babylonjs/core/Lights/hemisphericLight", () => ({
  HemisphericLight: FakeHemisphericLight,
}))
vi.mock("@babylonjs/core/Lights/pointLight", () => ({
  PointLight: FakePointLight,
}))
vi.mock("@babylonjs/core/Lights/spotLight", () => ({
  SpotLight: FakeSpotLight,
}))
vi.mock("@babylonjs/core/Layers/glowLayer", () => ({
  GlowLayer: FakeGlowLayer,
}))
vi.mock("@babylonjs/core/Cameras/universalCamera", () => ({ UniversalCamera: FakeUniversalCamera }))
vi.mock("@babylonjs/core/Engines/engine", () => ({ Engine: FakeEngine }))
vi.mock("@babylonjs/core/Engines/webgpuEngine", () => ({ WebGPUEngine: FakeWebGPUEngine }))
vi.mock("@babylonjs/core/scene", () => ({ Scene: FakeScene }))
vi.mock("@babylonjs/core/Culling/ray", () => ({}))

const stores = new Map<string, Map<string, unknown>>()

vi.mock("localforage", () => ({
  default: {
    createInstance: vi.fn((options: { storeName: string }) => {
      const store = stores.get(options.storeName) ?? new Map<string, unknown>()

      stores.set(options.storeName, store)

      return {
        getItem: vi.fn(async (key: string) => store.get(key) ?? null),
        setItem: vi.fn(async (key: string, value: unknown) => {
          store.set(key, value)
          return value
        }),
        removeItem: vi.fn(async (key: string) => {
          store.delete(key)
        }),
        keys: vi.fn(async () => [...store.keys()]),
      }
    }),
  },
}))

Object.assign(globalThis, {
  FakeColor3,
  FakeColor4,
  FakeVector3,
  FakeTexture,
  FakeMultiMaterial,
  FakeStandardMaterial,
  FakeSubMesh,
  FakeMesh,
  FakeVertexData,
  FakeDirectionalLight,
  FakeHemisphericLight,
  FakePointLight,
  FakeSpotLight,
  FakeGlowLayer,
  FakeUniversalCamera,
  FakeEngine,
  FakeWebGPUEngine,
  FakeScene,
})
