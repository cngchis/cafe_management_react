import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("API_PORT must be an integer between 1 and 65535");
}

export const config = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  apiPort: port,
  isProduction: process.env.NODE_ENV === "production",
};

if (config.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long");
}
