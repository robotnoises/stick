import { defineConfig } from "vite"

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id): string | undefined {
          if (id.includes("node_modules/@babylonjs/core/Engines")) {
            return "babylon-engine"
          }

          if (id.includes("node_modules/@babylonjs/core/Materials")) {
            return "babylon-materials"
          }

          if (id.includes("node_modules/@babylonjs/core/Meshes")) {
            return "babylon-meshes"
          }

          if (id.includes("node_modules/@babylonjs/core/Maths")) {
            return "babylon-math"
          }

          if (id.includes("node_modules/@babylonjs/core/Lights")) {
            return "babylon-lights"
          }

          if (id.includes("node_modules/@babylonjs/core/Cameras")) {
            return "babylon-cameras"
          }

          if (id.includes("node_modules/@babylonjs/core/Shaders")) {
            return "babylon-shaders"
          }

          if (id.includes("node_modules/@babylonjs/core/Rendering")) {
            return "babylon-rendering"
          }

          if (id.includes("node_modules/@babylonjs/core/PostProcesses")) {
            return "babylon-postprocesses"
          }

          if (
            id.includes("node_modules/@babylonjs/core/DeviceInput") ||
            id.includes("node_modules/@babylonjs/core/Inputs")
          ) {
            return "babylon-input"
          }

          if (id.includes("node_modules/@babylonjs/core/Audio")) {
            return "babylon-audio"
          }

          if (id.includes("node_modules/@babylonjs/core/Misc")) {
            return "babylon-misc"
          }

          if (id.includes("node_modules/@babylonjs/core/Buffers")) {
            return "babylon-buffers"
          }

          if (
            id.includes("node_modules/@babylonjs/core/Culling") ||
            id.includes("node_modules/@babylonjs/core/Layers")
          ) {
            return "babylon-render-helpers"
          }

          if (id.includes("node_modules/@babylonjs/core")) {
            return "babylon-core"
          }

          if (id.includes("node_modules/localforage")) {
            return "storage"
          }

          return undefined
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
  },
})
