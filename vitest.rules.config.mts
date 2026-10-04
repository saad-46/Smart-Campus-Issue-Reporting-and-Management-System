import { defineConfig } from "vitest/config";

// Security-rules tests. They need the Firestore emulator, so run them with
// `npm run test:rules` (which starts the emulator), not `npm test`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
