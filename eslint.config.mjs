import next from "eslint-config-next";

const dataAccess = [
  { name: "localStorage", message: "Components use hooks. Only lib/repo may touch localStorage." },
  { name: "sessionStorage", message: "Use the helpers in lib/ui instead." },
  { name: "BroadcastChannel", message: "Only lib/repo may sync across tabs." },
  { name: "indexedDB", message: "Use StoragePort." },
  { name: "fetch", message: "Components never call fetch. Use hooks, which call the repo." },
];

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "docs/screenshots/**", "playwright-report/**", "test-results/**"] },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": ["error", ...dataAccess],
      "no-restricted-imports": ["error", { patterns: ["@neondatabase/*", "**/lib/repo/mock/*", "**/lib/repo/neon/*"] }],
    },
  },
  {
    files: ["app/api/**/*.ts"],
    rules: { "no-restricted-globals": "off", "no-restricted-imports": "off" },
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
    },
  },
];

export default config;
