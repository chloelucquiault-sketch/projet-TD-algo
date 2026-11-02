import { randomBytes } from "node:crypto";
import { pool } from "./db/pool.js";

export async function getOrCreateDemoSessionSecret() {
  const generatedSecret = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO demo_session_secrets (singleton, signing_secret)
     VALUES (TRUE, $1)
     ON CONFLICT (singleton) DO NOTHING`,
    [generatedSecret],
  );
  const result = await pool.query<{ signing_secret: string }>(
    "SELECT signing_secret FROM demo_session_secrets WHERE singleton = TRUE",
  );
  const secret = result.rows[0]?.signing_secret;
  if (!secret) throw new Error("Impossible de charger le secret persistant des sessions de démonstration.");
  return secret;
}
