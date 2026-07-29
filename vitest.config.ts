import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Balíček server-only mimo React Server Components vyhodí chybu,
      // v testech ho tedy nahrazujeme prázdným modulem.
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      SESSION_SECRET: "testovaci-tajny-klic-pro-unit-testy",
    },
  },
});
