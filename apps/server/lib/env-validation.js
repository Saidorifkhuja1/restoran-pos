function requireValue(name, minLength) {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(`${name} is required and must be at least ${minLength} characters`);
  }
}

function validateEnv() {
  if (process.env.SKIP_ENV_VALIDATION === "true") return;
  requireValue("DATABASE_URL", 10);
  requireValue("JWT_SECRET", 32);
  requireValue("NEXTAUTH_SECRET", 32);
  if (process.env.RATE_LIMIT_PROD_REDIS_ONLY === "true") {
    requireValue("UPSTASH_REDIS_REST_URL", 10);
    requireValue("UPSTASH_REDIS_REST_TOKEN", 10);
  }
}

module.exports = { validateEnv };
