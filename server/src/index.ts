import { createApp } from "./app.js";
import { pool } from "./db/index.js";
import { config } from "./config.js";

const app = await createApp();

try {
  await app.listen({ host: "0.0.0.0", port: config.apiPort });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exitCode = 1;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await pool.end();
  });
}
