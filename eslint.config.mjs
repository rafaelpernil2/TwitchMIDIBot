import globals from "globals";
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import tseslint from 'typescript-eslint';

// ignore unused exports default
export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    eslintPluginPrettierRecommended,
    {

        files: ["**/*.ts"],

        // any additional configuration for these file types here


        languageOptions: {
            globals: {
                ...globals.node,
            },

            ecmaVersion: "latest",
            sourceType: "module",

            parserOptions: {
                project: "tsconfig.json",
            },
        },

        rules: {
            "@typescript-eslint/no-floating-promises": "off",
            "@typescript-eslint/no-misused-promises": "off",
            "no-sparse-arrays": "off",
        },
    });