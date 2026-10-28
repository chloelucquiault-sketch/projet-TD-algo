import "./config.js";
import { createApp } from "./app.js";
import { purgeExpiredCampPrivateData } from "./camp-private-data-retention.js";
import { pool } from "./db/pool.js";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
const privateDataRetentionIntervalMs = 15 * 60 * 1000;

const app = createApp();
const server = app.listen(port, "0.0.0.0", () => {
  console.info(`API disponible sur http://localhost:${port}`);
});

async function runPrivateDataRetention() {
  try {
    const deletedCount = await purgeExpiredCampPrivateData();
    if (deletedCount > 0) {
      console.info(`Données privées effacées après séjour : ${deletedCount} participant(s).`);
    }
  } catch (error) {
    console.error("Échec de l'effacement des données privées après séjour.", error);
  }
}

void runPrivateDataRetention();
const privateDataRetentionTimer = setInterval(() => void runPrivateDataRetention(), privateDataRetentionIntervalMs);
privateDataRetentionTimer.unref();

async function shutdown() {
  clearInterval(privateDataRetentionTimer);
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
