# Tree Rendering and Pine Improvement Plan

## Purpose

Trees are one of the main readability and realism features for Stick's Idaho forest. The current live pine is functional but too simple: it uses a trunk plus a single cone-like needle volume. This plan breaks the pine into procedural parts so each tree has a more believable silhouette while staying performant for streamed terrain chunks.

## Current State

Existing generated tree/wood prop types:

- `pine` — live pine with one tapered trunk and one cone-like needle mesh.
- `deadPine` — dead standing pine with a trunk and a few bare branches.
- `log` — fallen dead wood cylinder.

Current implementation location:

- `src/world/TerrainChunk.ts` creates the rendered prop meshes.
- `src/world/generation/TerrainGenerator.ts` places deterministic prop instances.
- `src/world/ChunkManager.ts` owns terrain/prop materials.

## Design Goals

- Make live pines look more realistic from hiking/navigation distance.
- Replace the single cone foliage mesh with visible branch structure and foliage clusters.
- Keep generation deterministic from the existing prop data so saved/generated chunks remain stable.
- Avoid hand-authoring every tree mesh at this stage.
- Support future reuse for dead trees, fallen branches, and additional species.
- Stay low-to-mid poly and compatible with chunk streaming.

## Non-Goals for First Pass

- Full botanical simulation.
- Per-needle geometry.
- Physics-enabled branch collision.
- Complex wind animation.
- Replacing procedural props with imported GLB tree assets.

## Proposed Pine Components

A live pine should be assembled from:

1. **Trunk**
   - Tapered cylinder.
   - Existing bark/trunk material.
   - Full tree height, visible through crown gaps.

2. **Primary branches**
   - Procedurally generated around the trunk in whorls.
   - Branch length changes based on height.
   - Lower/middle crown branches are longest.
   - Upper crown branches become shorter and angle upward.

3. **Secondary branch nodes / twigs**
   - Smaller side nodes along the outer half of primary branches.
   - These nodes hold most of the foliage cards.
   - They break up the cone silhouette.

4. **Leaf / needle cluster cards**
   - Flat or crossed planes using a transparent foliage texture.
   - For pines, the texture should be a pine needle cluster rather than a broad deciduous leaf.
   - Cards attach to secondary nodes and branch tips.

## Tree Profile Generation

Each `pine` prop should derive a deterministic profile at render time from existing data:

- `prop.id`
- `prop.scale`
- `prop.rotationY`
- optionally the world seed if exposed to the renderer later

Suggested profile values:

```ts
totalHeight
crownBaseHeight
crownHeight
trunkBaseDiameter
trunkTopDiameter
maxBranchLength
whorlCount
foliageDensity
shapeJitter
```

The terrain prop data does not need to persist every branch. The branch layout can be regenerated deterministically whenever the chunk is rebuilt.

## Branch Placement Rules

### Vertical Distribution

- Keep the lowest 20–30% of the trunk mostly clear of live branches.
- Start the crown around `crownBaseHeight`.
- Use `whorlCount` vertical levels between crown base and tree top.
- Space whorls roughly 0.8–1.4 meters apart, scaled by tree size.

### Branch Count Per Whorl

- 3–5 primary branches per whorl.
- Rotate each whorl relative to the previous whorl.
- Add small angular jitter so trees do not look radial/perfect.

### Branch Length by Height

Lower and middle crown branches should be longest. Upper branches should shrink toward the top.

Suggested formula:

```ts
const crownT = (branchHeight - crownBaseHeight) / crownHeight
const lengthFactor = Math.pow(1 - crownT, 0.85)
const bottomFade = clamp(crownT / 0.15, 0.55, 1)
const branchLength = maxBranchLength * lengthFactor * bottomFade * randomJitter
```

This creates a recognizable pine silhouette:

- narrow top
- broad lower/middle crown
- slight trunk visibility through the crown

### Branch Angle

- Lower branches: slightly drooped.
- Middle branches: mostly horizontal or gently upward.
- Upper branches: shorter and more upward.

Example angle rule:

```ts
const verticalAngle = lerp(-0.28, 0.38, crownT) + jitter
```

### Branch Diameter

- Branch diameter should taper from trunk to tip.
- Diameter should be proportional to branch length and tree scale.
- Upper branches should be thinner.

## Secondary Branch Nodes / Twigs

Each primary branch gets smaller nodes where foliage clusters attach.

Rules:

- Nodes appear mostly on the outer 45–90% of the branch.
- Node count depends on primary branch length.
  - short branch: 1–2 nodes
  - medium branch: 2–3 nodes
  - long branch: 3–5 nodes
- Nodes alternate left/right/up around the branch.
- Nodes should be short enough to read as twig structure, not full extra branches.
- Most foliage cards attach to node tips, with one optional card cluster at the primary branch tip.

## Leaf / Needle Component

The leaf component should be a reusable foliage card primitive.

For pines, use a transparent pine-needle cluster texture. Suggested exported asset path:

```txt
assets/exported/textures/props/pine-needle-cluster.png
```

Material requirements:

- Prefer PNG for the foliage card texture because the card needs transparency.
- Use JPG only for fully opaque textures such as bark, ground, and rock.
- Keep the PNG tightly cropped and reasonably small to reduce overdraw and memory cost.
- two-sided lighting
- `backFaceCulling = false`
- alpha support from the PNG
- low/no specular shine
- optional green tint variation

Possible Babylon material settings:

```ts
foliage.diffuseTexture = new Texture(pineNeedleClusterUrl, scene)
foliage.diffuseTexture.hasAlpha = true
foliage.useAlphaFromDiffuseTexture = true
foliage.backFaceCulling = false
foliage.twoSidedLighting = true
foliage.specularColor = Color3.Black()
```

The first pass can use untextured green cards or the existing `needles` material while the texture is being sourced.

## Mesh and Performance Strategy

Initial target per tree:

- 1 trunk mesh.
- 20–60 primary/secondary wood segments for medium/large trees.
- 30–100 foliage cards depending on scale.

Performance notes:

- Avoid thousands of individual leaves.
- Prefer leaf/needle cluster cards over individual geometry.
- Do not create one Babylon mesh per branch, twig, or foliage cluster; that caused severe tab memory growth and poor frame time in dense loaded forests.
- Keep each pine near 3 meshes for now: trunk, one merged branch mesh, and one merged foliage mesh.
- Longer term, consider chunk-level merged vegetation meshes or instancing if profiling shows mesh count pressure.

## Implementation Breakdown

### Phase 1 — Planning and Data Shape

- [x] Document procedural pine improvement plan.
- [ ] Decide whether tree profile generation needs access to world seed or can rely on `prop.id`.
- [ ] Define internal TypeScript interfaces for pine profile, branch specs, twig specs, and foliage card specs.
- [ ] Add deterministic random helper for per-tree rendering variation.

### Phase 2 — Branch Geometry Helper

- [x] Add a helper to create a tapered branch cylinder between two points.
- [x] Add branch orientation math from trunk anchor to branch tip.
- [x] Add branch length/angle rules based on normalized crown height.
- [x] Add whorl generation with rotation and jitter.
- [x] Keep branches using existing trunk/bark material at first.

### Phase 3 — Replace Live Pine Cone

- [x] Update `_createPineProp` in `src/world/TerrainChunk.ts` to create procedural branches.
- [x] Remove or disable the single cone-like `needles` mesh for live pines.
- [x] Add placeholder foliage cards at branch/node tips.
- [ ] Tune tree height, crown base, branch count, and card count for readability.

### Phase 4 — Foliage Texture Material

- [x] Source/download a transparent pine needle cluster texture.
- [x] Export it to `assets/exported/textures/props/pine-needle-cluster.png`.
- [x] Add a `pineFoliage` or `foliage` material to `TerrainChunkMaterials`.
- [x] Wire the material in `src/world/ChunkManager.ts`.
- [x] Apply the texture to foliage cards.
- [x] Tune alpha mode, color tint, card scale, and card orientation.

### Phase 5 — Performance Pass

- [ ] Profile loaded forest chunks with the new trees.
- [x] Reduce branch/card count after the first branch-per-mesh pass caused high memory usage.
- [x] Merge per-tree wood/foliage meshes.
- [ ] Consider chunk-level vegetation batching if many separate meshes become a bottleneck.

### Phase 6 — Dead Pine Reuse

- [x] Reuse branch generation helpers for `deadPine`.
- [x] Generate fewer, broken-looking bare branches.
- [x] Remove foliage card generation for dead pines.
- [x] Add small variation in missing/broken branch whorls.

### Phase 6.5 — Fallen Log Polish

- [x] Add deterministic length/diameter variation to logs.
- [x] Add small broken branch stubs to logs.
- [ ] Add exposed cut/sawn end texture or separate end-cap material later.

### Phase 6.75 — Forest Composition

- [x] Add deterministic forest density patches.
- [x] Add sparse clearing patches.
- [x] Add deadfall zones that bias toward logs and dead pines.
- [x] Add stand-age patches that influence pine scale.
- [x] Add ground litter cards using `assets/exported/textures/props/pine-needle-litter.png`.

### Phase 7 — Future Tree Variety

- [x] Add small/medium/large pine profiles.
- [x] Add young pine/sapling-like profile.
- [x] Add sparse/stressed pine profile.
- [ ] Add burned or snapped dead tree variants.
- [ ] Add additional Idaho forest species after pine is solid.

## Acceptance Criteria for First Improved Pine

- Live pine no longer reads as a single green cone.
- Branches are visible near the silhouette and through crown gaps.
- Tree shape narrows naturally toward the top.
- Foliage appears as clustered leaf/needle masses attached to branches.
- Trees remain deterministic across chunk unload/reload.
- Forest chunks remain playable without obvious rendering hitches.

## Open Questions

- Should the first foliage texture be realistic photographic pine needles, stylized painted needles, or low-poly atlas art?
- Should foliage cards be mostly horizontal, face outward from branch direction, or use crossed-card clusters?
- Should tree profile generation be pure render-time logic, or should future chunk data persist explicit tree variant IDs?
- How aggressive should mesh merging be before adding more flora?
