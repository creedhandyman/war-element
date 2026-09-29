import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The effects worker (src/ui/vfx/vfx-worker.ts) is a module worker: Pixi
  // loads its renderer as a separate chunk, and only ES output can split.
  worker: { format: "es" },
  test: {
    include: ["src/engine/__tests__/**/*.test.ts"],
    environment: "node",
  },
} as never);
