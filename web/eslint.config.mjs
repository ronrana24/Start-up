import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@presentation/*", "@infrastructure/*", "@application/*"],
              message:
                "Domain must not depend on outer layers (clean architecture).",
            },
            {
              group: ["react", "react-dom", "next/*", "@tanstack/*", "zustand"],
              message: "Domain must stay framework-agnostic.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@presentation/*", "@infrastructure/*"],
              message:
                "Application depends on ports only; wire adapters in infrastructure/presentation composition.",
            },
            {
              group: ["react", "react-dom", "next/*", "@tanstack/*", "zustand"],
              message: "Application use cases must stay framework-agnostic.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
