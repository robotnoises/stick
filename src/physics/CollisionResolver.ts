import type { GeneratedPropData } from "../world/terrain/TerrainTypes"

export interface HorizontalPoint {
  readonly x: number
  readonly z: number
}

export interface CollisionResolverOptions {
  readonly playerRadiusMeters?: number
  readonly maxIterations?: number
}

interface CircularCollider {
  readonly x: number
  readonly z: number
  readonly radius: number
}

export class CollisionResolver {
  private static readonly _defaultPlayerRadiusMeters = 0.35
  private static readonly _defaultMaxIterations = 3

  public static resolvePointAgainstProps(
    target: HorizontalPoint,
    props: readonly GeneratedPropData[],
    options: CollisionResolverOptions = {},
  ): HorizontalPoint {
    const playerRadiusMeters =
      options.playerRadiusMeters ?? CollisionResolver._defaultPlayerRadiusMeters
    const maxIterations = options.maxIterations ?? CollisionResolver._defaultMaxIterations
    const colliders = props
      .map((prop) => CollisionResolver._toCircularCollider(prop))
      .filter((collider): collider is CircularCollider => collider !== null)

    let resolvedX = target.x
    let resolvedZ = target.z

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      let moved = false

      for (const collider of colliders) {
        const minDistance = collider.radius + playerRadiusMeters
        const dx = resolvedX - collider.x
        const dz = resolvedZ - collider.z
        const distanceSquared = dx * dx + dz * dz

        if (distanceSquared >= minDistance * minDistance) {
          continue
        }

        if (distanceSquared === 0) {
          resolvedX = collider.x + minDistance
          moved = true
          continue
        }

        const distance = Math.sqrt(distanceSquared)
        const push = minDistance - distance

        resolvedX += (dx / distance) * push
        resolvedZ += (dz / distance) * push
        moved = true
      }

      if (!moved) {
        break
      }
    }

    return { x: resolvedX, z: resolvedZ }
  }

  private static _toCircularCollider(prop: GeneratedPropData): CircularCollider | null {
    const radius = CollisionResolver._getPropCollisionRadius(prop)

    if (radius <= 0) {
      return null
    }

    return {
      x: prop.position[0],
      z: prop.position[2],
      radius,
    }
  }

  private static _getPropCollisionRadius(prop: GeneratedPropData): number {
    switch (prop.type) {
      case "pine":
        return 0.42 * prop.scale
      case "deadPine":
        return 0.36 * prop.scale
      case "rock":
        return 0.58 * prop.scale
      case "log":
        return 0.44 * prop.scale
      case "grass":
        return 0
    }
  }
}
