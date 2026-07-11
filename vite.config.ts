import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/engine/__tests__/**/*.test.ts"],
    environment: "node",
  },
} as never);
