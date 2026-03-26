import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
    ...nextCoreWebVitals,
    {
        rules: {
            // Next.js specific overrides
            "react/no-unescaped-entities": "off",
            "@next/next/no-img-element": "off",

            // React hooks
            "react-hooks/exhaustive-deps": "warn",
            "react-hooks/set-state-in-effect": "warn",

            // Variables
            "no-unused-vars": ["warn", { "varsIgnorePattern": "^_", "argsIgnorePattern": "^_" }],
            "no-undef": "error",
            "no-shadow": "warn",
            "prefer-const": "warn",

            // Code quality
            "eqeqeq": ["warn", "always", { "null": "ignore" }],
            "no-debugger": "warn",
            "no-var": "error",

            // Potential bugs
            "no-unreachable": "error",
            "no-duplicate-imports": "warn",
            "no-self-compare": "error",
            "no-template-curly-in-string": "warn",
            "array-callback-return": "warn",
        },
    },
];

export default config;