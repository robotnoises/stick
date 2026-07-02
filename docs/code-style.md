# Stick Code Style Guide

For required test coverage and completion checks, see [Coding Standards](coding-standards.md).

## Formatter Baseline

Prettier is the baseline formatter.

Project rules:

- Use double quotes.
- Do not use semicolons.
- Use trailing commas where Prettier adds them.
- Prefer a max line width around 100 characters.

See `.prettierrc.json` for enforced formatting rules.

## General Style Goals

Code should read as small, clear phases of work. Prefer intentional whitespace over dense blocks.

Good code should make these things obvious:

1. What is being created.
2. How it is configured.
3. Where it is attached/stored/used.
4. When execution moves to the next logical task.

## Whitespace and Grouping

Use a single blank line between logical groups.

### Group similar declarations together

If several constants are part of the same setup phase, keep them together with no blank line between each declaration.

```ts
const trunkMaterial = new StandardMaterial("pine-trunk-placeholder", this._context.scene)
const needlesMaterial = new StandardMaterial("pine-needles-placeholder", this._context.scene)

trunkMaterial.diffuseColor.set(0.34, 0.21, 0.12)
needlesMaterial.diffuseColor.set(0.12, 0.28, 0.15)
```

### Separate creation from configuration

When an object is created and then configured, put a blank line between creation and mutation/configuration.

```ts
const material = new StandardMaterial("terrain-placeholder", this._context.scene)

material.diffuseColor.set(0.35, 0.43, 0.22)
material.specularColor.set(0, 0, 0)
ground.material = material
```

### Separate large object creation from follow-up use

For multi-line Babylon factory calls, leave a blank line before assigning properties.

```ts
const trunk = MeshBuilder.CreateCylinder(
  `pine_${index}_trunk`,
  {
    height: trunkHeight,
    diameterTop: 0.35,
    diameterBottom: 0.55,
  },
  this._context.scene,
)

trunk.position = position.add(new Vector3(0, trunkHeight / 2, 0))
trunk.material = trunkMaterial
```

### Avoid excessive vertical spacing

Use one blank line between logical groups. Do not use multiple blank lines unless there is a very strong readability reason.

## Imports

Use narrow Babylon imports where practical. This helps keep bundle size down and avoids importing all of Babylon accidentally.

Preferred:

```ts
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
```

Avoid unless there is a specific reason:

```ts
import { MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core"
```

Use `import type` for type-only imports.

```ts
import type { EngineContext } from "../app/EngineContext"
import type { GameSystem } from "../app/GameSystem"
```

If a Babylon feature requires a side-effect import, keep it explicit and near the imports that need it.

```ts
import "@babylonjs/core/Culling/ray"
```

## Classes

Use class-based OOP for systems, services, controllers, and domain objects.

Preferred ordering inside a class:

1. Private fields
2. Constructor
3. Public getters
4. Public lifecycle methods
5. Public methods
6. Private helper methods

Example:

```ts
export class ExampleSystem implements GameSystem {
  private _enabled = true

  public constructor(private readonly _context: EngineContext) {}

  public get enabled(): boolean {
    return this._enabled
  }

  public initialize(): void {
    // setup
  }

  public update(deltaSeconds: number): void {
    // frame work
  }

  private _doInternalWork(): void {
    // helper
  }
}
```

## Access Modifiers and Naming

Use explicit access modifiers for class members.

- `public` for intentional API surface.
- `private` for implementation details.
- `readonly` for injected dependencies and values that should not be reassigned.
- Prefix private fields and private methods with `_`.

Examples:

```ts
private readonly _context: EngineContext
private _elapsedSeconds = 0

private _createLandmarkPines(): void {}
```

## Types

Prefer explicit return types on public methods and lifecycle methods.

```ts
public initialize(): void {}
public update(deltaSeconds: number): void {}
public dispose(): void {}
```

Use inferred types for obvious local variables.

```ts
const trunkHeight = 5 + index
```

Use interfaces for data shapes and contracts.

```ts
export interface GameSystem {
  initialize?(): Promise<void> | void
  update(deltaSeconds: number): void
  dispose?(): void
}
```

## System Design

Game systems should be small and lifecycle-oriented.

Preferred pattern:

```ts
export class SomeSystem implements GameSystem {
  public initialize(): void {}
  public update(deltaSeconds: number): void {}
  public dispose(): void {}
}
```

Guidelines:

- Keep Babylon access behind injected `EngineContext` when possible.
- Prefer constructor injection for dependencies.
- Avoid global mutable state.
- Keep update methods readable and short.
- Move detailed setup into private helper methods when a method grows too large.

## Comments

Use comments when they explain intent, coordinate conventions, non-obvious math, or engine quirks.

Good:

```ts
/**
 * Heading in degrees relative to world north.
 * Convention: +Z is north, +X is east.
 */
```

Avoid comments that only restate the line of code.

## Reference Example

`src/world/TestTerrainSystem.ts` is a good reference for the preferred spacing style:

- imports grouped tightly
- object creation separated from mutation/configuration
- similar declarations grouped together
- single blank line between logical phases
