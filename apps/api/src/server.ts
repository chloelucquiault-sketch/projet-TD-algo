import "./config.js";
import { createApp } from "./app.js";
import { pool } from "./db/pool.js";

const port = Number(process.env.API_PORT ?? 3001);
const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error("SESSION_SECRET doit contenir au moins 32 caractères en production.");
}

const app = createApp();
const server = app.listen(port, () => {
  console.info(`API disponible sur http://localhost:${port}`);
});

async function shutdown() {
  server.close(async (error) => {
    if (error) {
      console.error("Échec de l'arrêt du serveur API.", error);
      process.exitCode = 1;
    }
    await pool.end();
  });
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
