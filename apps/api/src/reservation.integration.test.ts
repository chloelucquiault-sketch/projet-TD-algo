import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const suite = testDatabaseUrl ? describe : describe.skip;

suite("API de réservation avec PostgreSQL", () => {
  let pool: (typeof import("./db/pool.js"))["pool"];
  let createApp: (typeof import("./app.js"))["createApp"];
  let server: Server | undefined;
  let baseUrl = "";
  let complexId = "";
  let customerId = "";
  let registeredCustomerId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    process.env.SESSION_SECRET = "integration-test-secret-at-least-32-characters";
    const database = await import("./db/pool.js");
    pool = database.pool;
    ({ createApp } = await import("./app.js"));
    const schema = await pool.query<{ exists: boolean }>(
      "SELECT to_regclass('public.bookings') IS NOT NULL AS exists",
    );
    if (!schema.rows[0]?.exists) {
      throw new Error("La base TEST_DATABASE_URL doit avoir reçu les migrations.");
    }
    const app = createApp();
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const address = server!.address();
    if (!address || typeof address === "string") throw new Error("Impossible de déterminer le port du serveur de test.");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const customer = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, 'unused', 'Club test', 'customer') RETURNING id`,
      [`test-${unique}@example.test`],
    );
    customerId = customer.rows[0]!.id;
    const complex = await pool.query<{ id: string }>(
      `INSERT INTO complexes (name, description, region, address, is_published)
       VALUES ($1, 'Complexe de test', 'Test', 'Test', TRUE) RETURNING id`,
      [`Complexe d'intégration ${unique}`],
    );
    complexId = complex.rows[0]!.id;
    const sport = await pool.query<{ id: string }>("SELECT id FROM sports WHERE slug = 'football'");
    if (!sport.rows[0]) throw new Error("Les sports de référence doivent être présents après les migrations.");
    await pool.query(
      `INSERT INTO facilities (complex_id, sport_id, name, facility_type)
       VALUES ($1, $2, 'Terrain test', 'Terrain')`,
      [complexId, sport.rows[0].id],
    );
    await pool.query(
      "INSERT INTO dormitories (complex_id, name, bed_count) VALUES ($1, 'Dortoir test', 12)",
      [complexId],
    );
  }, 30_000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    if (pool) {
      if (customerId) {
        if (complexId) await pool.query("DELETE FROM bookings WHERE complex_id = $1", [complexId]);
        if (registeredCustomerId) {
          await pool.query("DELETE FROM session WHERE sess->>'userId' = $1", [registeredCustomerId]);
          await pool.query("DELETE FROM users WHERE id = $1", [registeredCustomerId]);
        }
        if (complexId) await pool.query("DELETE FROM complexes WHERE id = $1", [complexId]);
        await pool.query("DELETE FROM users WHERE id = $1", [customerId]);
      }
      await pool.end();
    }
  }, 30_000);

  it("ne crée pas deux séjours qui se chevauchent sur le même équipement", async () => {
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `session-${Date.now()}@example.test`,
        password: "un-mot-de-passe-integration",
        fullName: "Responsable test",
      }),
    });
    expect(registration.status).toBe(201);
    const registered = await registration.json() as { user: { id: string } };
    registeredCustomerId = registered.user.id;
    const cookie = registration.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();

    const resources = await pool.query<{ facility_id: string; dormitory_id: string }>(
      `SELECT f.id AS facility_id, d.id AS dormitory_id
       FROM facilities f CROSS JOIN dormitories d
       WHERE f.complex_id = $1 AND d.complex_id = $1`,
      [complexId],
    );
    const resource = resources.rows[0]!;
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 30);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 3);
    const body = {
      complexId,
      checkIn: start.toISOString().slice(0, 10),
      checkOut: end.toISOString().slice(0, 10),
      groupSize: 10,
      groupType: "Club sportif",
      facilityIds: [resource.facility_id],
      dormitories: [{ dormitoryId: resource.dormitory_id, bedsReserved: 10 }],
      mealOptionId: null,
    };
    const create = () => fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie! },
      body: JSON.stringify(body),
    });
    const [first, second] = await Promise.all([create(), create()]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
  }, 30_000);
});
