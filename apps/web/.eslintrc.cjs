module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: ["eslint:recommended", "plugin:react-hooks/recommended"],
  env: { browser: true, es2022: true },
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  settings: { react: { version: "detect" } },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "no-unused-vars": "off",
    "no-undef": "off",
  },
};
