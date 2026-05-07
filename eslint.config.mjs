import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  ...nextVitals,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@radix-ui/react-label", message: "Import Label from @/components/ui/label" },
            { name: "@radix-ui/react-dropdown-menu", message: "Use @/components/ui/dropdown-menu" },
            { name: "@radix-ui/react-checkbox", message: "Use @/components/ui/checkbox" },
            { name: "@radix-ui/react-select", message: "Use @/components/ui/select" },
            { name: "@radix-ui/react-accordion", message: "Use @/components/ui/accordion" },
          ],
        },
      ],
      "react-hooks/error-boundaries": "off",
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
  {
    files: ["**/lib/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["**/components/ui/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
