import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import _import from "eslint-plugin-import";
import eslintComments from "eslint-plugin-eslint-comments";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["**/node_modules", "**/build", "**/coverage"],
}, ...fixupConfigRules(compat.extends(
    "eslint:recommended",
    "plugin:eslint-comments/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/typescript",
    "prettier",
)), {
    plugins: {
        import: fixupPluginRules(_import),
        "eslint-comments": fixupPluginRules(eslintComments),
        "@typescript-eslint": fixupPluginRules(typescriptEslint),
    },

    languageOptions: {
        globals: {
            BigInt: true,
            console: true,
            WebAssembly: true,
        },

        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "script",

        parserOptions: {
            project: "./tsconfig.json",
        },
    },

    rules: {
        "@typescript-eslint/explicit-module-boundary-types": "off",

        "eslint-comments/disable-enable-pair": ["error", {
            allowWholeFile: true,
        }],

        "eslint-comments/no-unused-disable": "error",

        "import/order": ["error", {
            "newlines-between": "always",

            alphabetize: {
                order: "asc",
            },
        }],

        "sort-imports": ["error", {
            ignoreDeclarationSort: true,
            ignoreCase: true,
        }],
    },
}];