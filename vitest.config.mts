import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit-test baseline (RBAC epic). Pure node-environment tests only for now —
 * no jsdom; component/browser suites arrive with later epics. The include
 * pattern deliberately matches only TypeScript test files under src (the
 * ".test.ts" / ".test.tsx" suffixes) so the legacy node:test file
 * (src/components/auth/validation.test.mjs) keeps running under
 * `node --test` untouched, outside this suite.
 *
 * `.mts`, not `.ts`: the package has no `"type": "module"` and vitest 5's
 * bundler loads a `.ts` config as CommonJS, which rejects ESM syntax.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
});
