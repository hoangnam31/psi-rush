import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "dist/**",
    ".vinext/**",
    ".wrangler/**",
    ".sites-runtime/**",
    "outputs/**",
    "work/**",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/host/page.tsx", "app/join/page.tsx", "app/play/page.tsx"],
    rules: {
      // These pages hydrate browser-only room sessions and start polling on
      // mount; the state writes are intentional synchronization effects.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["components/RoomTrack.tsx"],
    rules: {
      // Animation positions live in refs so the host overview can interpolate
      // at 60 FPS without re-rendering the entire player list every frame.
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
