import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      // Next.js specific overrides
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",

      // React hooks (React Compiler rules from eslint-plugin-react-hooks 7).
      //
      // immutability and refs are clean and enforced: the codebase no longer
      // calls a function declared below the effect that uses it, and no longer
      // writes a ref during render. Both are real correctness rules — a
      // render-phase ref write is unsafe under concurrent rendering — so they
      // are errors to stop a regression sneaking back in.
      "react-hooks/immutability": "error",
      "react-hooks/refs": "error",

      // exhaustive-deps is clean too, but stays a warning: it is advisory by
      // nature, matches the ecosystem default, and the handful of deliberate
      // exceptions are already suppressed inline where they occur.
      "react-hooks/exhaustive-deps": "warn",

      // set-state-in-effect stays a warning. The ~27 remaining reports are all
      // the same shape: `useEffect(() => { fetchX() }, [...])` where fetchX is
      // an async loader whose first statement is setLoading(true), so the rule
      // sees a synchronous setState before the first await. That is the normal
      // fetch-on-mount effect, not a defect — silencing it would mean dropping
      // the loading state, hiding the call behind a microtask, or adopting a
      // data-fetching library. Treat a NEW report here as worth reading, not
      // as automatically wrong: the rule does catch genuine derived-state
      // misuse, which is how the write-only userHasCreatedProposal state and
      // its proposals.some() effect in session/[id].tsx were found and
      // deleted.
      "react-hooks/set-state-in-effect": "warn",

      // Variables. Note the TypeScript-aware replacement for no-unused-vars
      // in the *.ts/*.tsx block at the bottom of this file.
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
  {
    // TypeScript only. The base no-unused-vars rule reads the parameter names
    // in a function *type* annotation — `onRate: (id: string, rating: number)
    // => void` — as unused bindings, when they are only documentation. The
    // @typescript-eslint version understands the distinction and still reports
    // genuinely unused values. Scoped to TS because eslint-config-next only
    // registers the plugin for TypeScript files; applying it repo-wide makes
    // ESLint fail outright on the remaining .js pages.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
