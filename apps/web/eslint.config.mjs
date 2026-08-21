import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      // Next.js specific overrides
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",

      // React hooks.
      // The React Compiler rules that ship with eslint-plugin-react-hooks 7
      // flag long-standing patterns in this codebase (effects calling a
      // function declared further down, refs read during render). They are
      // real cleanups worth doing, but they are demoted to warnings so the
      // build is not gated on a refactor of ~8 pre-existing files.
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",

      // Variables
      "no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      "no-undef": "error",
      "no-shadow": "warn",
      "prefer-const": "warn",

      // Code quality
      eqeqeq: ["warn", "always", { null: "ignore" }],
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
