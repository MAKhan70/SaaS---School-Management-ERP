import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: dirname });

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "next-env.d.ts",
      "node_modules/**",
      "outputs/**",
      "src/generated/**",
      "supabase/functions/**",
      "work/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
];

export default eslintConfig;
