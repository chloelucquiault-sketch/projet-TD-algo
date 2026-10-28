import "./config.js";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pool } from "./db/pool.js";
import { errorHandler, HttpError } from "./errors.js";
import { loadUser } from "./middleware/auth.js";
import routes from "./routes.js";
import campRoutes from "./camp-routes.js";
import { assertHealthDataEncryptionKey } from "./security/health-data.js";

const PgSession = connectPgSimple(session);

export function createApp() {
  assertHealthDataEncryptionKey();
  const app = express();
  const production = process.env.NODE_ENV === "production";
  const demoMode = process.env.DEMO_MODE === "true";
  const sessionSecret = process.env.SESSION_SECRET ?? (demoMode ? randomBytes(32).toString("base64url") : undefined);
  if (!sessionSecret || (!demoMode && sessionSecret.length < 32)) {
    throw new Error("SESSION_SECRET doit être défini et contenir au moins 32 caractères.");
  }
  if (demoMode && !process.env.SESSION_SECRET) {
    console.warn("Mode démo : les sessions expireront au redémarrage et les données de santé ne seront pas chiffrées.");
  }
  app.disable("x-powered-by");
  if (production) app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "512kb" }));
  app.get("/api/health", async (_request, response) => {
    try {
      await pool.query("SELECT 1");
      response.json({ status: "ok" });
    } catch (error) {
      console.error("La vérification de santé de l'API a échoué.", error);
      response.status(503).json({ status: "unavailable" });
    }
  });
  app.use(express.static(resolve(process.cwd(), "apps/web/dist")));
  app.use(session({
    name: "sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: false,
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: production || process.env.COOKIE_SECURE === "true",
      path: process.env.COOKIE_PATH ?? "/",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }));
  app.use((request, _response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      next();
      return;
    }
    const origin = request.get("origin");
    if (!origin) {
      next();
      return;
    }
    const allowedOrigin = process.env.WEB_ORIGIN ?? `${request.protocol}://${request.get("host")}`;
    if (origin !== allowedOrigin) {
      next(new HttpError(403, "Origine de requête non autorisée."));
      return;
    }
    next();
  });
  app.use("/api/auth", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }));
  app.use(loadUser);
  app.use(routes);
  app.use(campRoutes);
  app.use((request, response, next) => {
    if (request.method === "GET" && request.accepts("html") && !request.path.startsWith("/api/") && request.path !== "/api") {
      response.sendFile(resolve(process.cwd(), "apps/web/dist/index.html"), (error) => {
        if (error) next(error);
      });
      return;
    }
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Cette ressource n'existe pas." } });
  });
  app.use(errorHandler);
  return app;
}
