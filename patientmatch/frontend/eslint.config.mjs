import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
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
            { name: "@supabase/supabase-js", message: "Use supabaseClient/supabaseServer/supabaseAdmin helpers." },
          ],
        },
      ],
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
