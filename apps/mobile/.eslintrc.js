module.exports = {
  extends: "expo",
  ignorePatterns: ["/dist/*", "/.expo/*"],
  // No react-hooks rule overrides here on purpose. This app is on ESLint 8 +
  // eslint-config-expo 10, which pins eslint-plugin-react-hooks ^5 — a version
  // that predates the React Compiler rules (immutability / refs /
  // set-state-in-effect). Referencing those rules errors with "Definition for
  // rule ... was not found" on every file.
  //
  // The plugin is declared as a direct devDependency so this stays true: the
  // web app pulls in react-hooks 7 via eslint-config-next, and with two copies
  // in the workspace ESLint 8's cwd-relative plugin resolution would otherwise
  // pick either one depending on how pnpm last laid out node_modules.
  // apps/web/eslint.config.mjs is where those rules are demoted to warnings.
};
