// This file is required to use environment variables in the app
const { loadEnvConfig } = require("@next/env");
const path = require("path");

loadEnvConfig(path.resolve(process.cwd(), ".env"));
