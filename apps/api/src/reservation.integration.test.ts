import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
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
  let registeredCookie = "";
  let adminId = "";
  let adminEmail = "";
  let dayBookingId = "";
  let campSessionId = "";
  let testSportIds: string[] = [];
  const retentionSessionIds: string[] = [];
  const retentionEnrollmentIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    process.env.SESSION_SECRET = "integration-test-secret-at-least-32-characters";
    process.env.HEALTH_DATA_ENCRYPTION_KEY = "22".repeat(32);
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
       VALUES ($1, 'Complexe de test', 'Alpes', 'Test', TRUE) RETURNING id`,
      [`Complexe d'intégration ${unique}`],
    );
    complexId = complex.rows[0]!.id;
    const sports = await pool.query<{ id: string }>(
      `INSERT INTO sports (name, slug)
       VALUES ($1, $2), ($3, $4)
       RETURNING id`,
      [
        `Football test ${unique}`,
        `football-test-${unique}`,
        `Rugby test ${unique}`,
        `rugby-test-${unique}`,
      ],
    );
    testSportIds = sports.rows.map((sport) => sport.id);
    if (sports.rowCount !== 2) throw new Error("Impossible de créer les sports de test.");
    const facility = await pool.query<{ id: string }>(
      `INSERT INTO facilities (complex_id, name, facility_type)
       VALUES ($1, 'Terrain test', 'Terrain') RETURNING id`,
      [complexId],
    );
    await pool.query(
      "INSERT INTO facility_sports (facility_id, sport_id) VALUES ($1, $2), ($1, $3)",
      [facility.rows[0]!.id, sports.rows[0]!.id, sports.rows[1]!.id],
    );
    await pool.query(
      "INSERT INTO dormitories (complex_id, name, bed_count) VALUES ($1, 'Dortoir test', 12)",
      [complexId],
    );
  }, 30_000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    if (pool) {
      if (campSessionId) {
        await pool.query(
          "DELETE FROM camp_participants WHERE enrollment_id IN (SELECT id FROM camp_enrollments WHERE camp_session_id = $1)",
          [campSessionId],
        );
        await pool.query("DELETE FROM camp_enrollments WHERE camp_session_id = $1", [campSessionId]);
        await pool.query("DELETE FROM camp_sessions WHERE id = $1", [campSessionId]);
      }
      for (const retentionSessionId of retentionSessionIds) {
        await pool.query(
          "DELETE FROM camp_participants WHERE enrollment_id IN (SELECT id FROM camp_enrollments WHERE camp_session_id = $1)",
          [retentionSessionId],
        );
        await pool.query("DELETE FROM camp_enrollments WHERE camp_session_id = $1", [retentionSessionId]);
        await pool.query("DELETE FROM camp_sessions WHERE id = $1", [retentionSessionId]);
      }
      if (customerId) {
        if (complexId) await pool.query("DELETE FROM bookings WHERE complex_id = $1", [complexId]);
        if (registeredCustomerId) {
          await pool.query("DELETE FROM session WHERE sess->>'userId' = $1", [registeredCustomerId]);
          await pool.query("DELETE FROM users WHERE id = $1", [registeredCustomerId]);
        }
        if (complexId) await pool.query("DELETE FROM complexes WHERE id = $1", [complexId]);
        await pool.query("DELETE FROM users WHERE id = $1", [customerId]);
      }
      if (testSportIds.length) {
        await pool.query("DELETE FROM sports WHERE id = ANY($1::uuid[])", [testSportIds]);
      }
      if (adminId) {
        await pool.query("DELETE FROM session WHERE sess->>'userId' = $1", [adminId]);
        await pool.query("DELETE FROM users WHERE id = $1", [adminId]);
      }
      await pool.end();
    }
  }, 30_000);

  it("impose un seul lieu et un seul compte administrateur", async () => {
    await expect(pool.query(
      `INSERT INTO complexes (name, description, region, address)
       VALUES ('Second lieu interdit', '', 'Alpes', '')`,
    )).rejects.toMatchObject({ code: "23505" });

    adminEmail = `admin-${Date.now()}@example.test`;
    const adminPassword = "admin-integration-password";
    const firstAdmin = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, 'Admin test', 'admin') RETURNING id`,
      [adminEmail, await bcrypt.hash(adminPassword, 4)],
    );
    adminId = firstAdmin.rows[0]!.id;
    await expect(pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, 'unused', 'Second admin', 'admin')`,
      [`second-admin-${Date.now()}@example.test`],
    )).rejects.toMatchObject({ code: "23505" });
  });

  it("ne crée pas deux séjours qui se chevauchent sur le même équipement", async () => {
    const detailResponse = await fetch(`${baseUrl}/api/complexes/${complexId}`);
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as { facilities: { sportNames: string[] }[] };
    expect(detail.facilities).toHaveLength(1);
    expect(detail.facilities[0]!.sportNames).toHaveLength(2);

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
    registeredCookie = registration.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(registeredCookie).toBeTruthy();

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
      bookingType: "stay",
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
      headers: { "content-type": "application/json", cookie: registeredCookie },
      body: JSON.stringify(body),
    });
    const [first, second] = await Promise.all([create(), create()]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const createdBooking = first.status === 201 ? first : second;
    dayBookingId = (await createdBooking.json() as { booking: { id: string } }).booking.id;

    const forbiddenAdminAction = await fetch(`${baseUrl}/api/admin/complexes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: registeredCookie },
      body: JSON.stringify({ name: "Complexe interdit", region: "Alpes" }),
    });
    expect(forbiddenAdminAction.status).toBe(403);

    const dayAvailability = await fetch(
      `${baseUrl}/api/complexes/${complexId}/day-availability?date=${body.checkIn}&facilityId=${resource.facility_id}`,
    );
    expect(dayAvailability.status).toBe(200);
    const daySlots = await dayAvailability.json() as { slots: { available: boolean }[] };
    expect(daySlots.slots.every((slot) => !slot.available)).toBe(true);
  }, 30_000);

  it("n'autorise qu'une demande journalière simultanée pour les mêmes créneaux", async () => {
    const resources = await pool.query<{ facility_id: string }>(
      "SELECT id AS facility_id FROM facilities WHERE complex_id = $1",
      [complexId],
    );
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + 60);
    const body = {
      bookingType: "day",
      complexId,
      checkIn: day.toISOString().slice(0, 10),
      facilityId: resources.rows[0]!.facility_id,
      startTimes: ["08:00", "11:30"],
      groupSize: 10,
      groupType: "Club sportif",
    };
    const create = () => fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: registeredCookie },
      body: JSON.stringify(body),
    });
    const [first, second] = await Promise.all([create(), create()]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const savedSlots = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM booking_day_slots s
       JOIN bookings b ON b.id = s.booking_id
       WHERE b.complex_id = $1 AND b.booking_type = 'day' AND s.slot_date = $2`,
      [complexId, body.checkIn],
    );
    expect(savedSlots.rows[0]!.count).toBe("2");

    const stayOnReservedDay = await fetch(`${baseUrl}/api/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: registeredCookie },
      body: JSON.stringify({
        bookingType: "stay",
        complexId,
        checkIn: body.checkIn,
        checkOut: new Date(day.getTime() + 3 * 86_400_000).toISOString().slice(0, 10),
        groupSize: 10,
        groupType: "Club sportif",
        facilityIds: [resources.rows[0]!.facility_id],
        dormitories: [{ dormitoryId: (await pool.query<{ id: string }>(
          "SELECT id FROM dormitories WHERE complex_id = $1",
          [complexId],
        )).rows[0]!.id, bedsReserved: 10 }],
        mealOptionId: null,
      }),
    });
    expect(stayOnReservedDay.status).toBe(409);
  }, 30_000);

  it("enregistre l'administrateur et l'heure lors du traitement d'une demande", async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: "admin-integration-password" }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();
    const savedSession = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM session WHERE sess->>'userId' = $1",
      [adminId],
    );
    expect(savedSession.rows[0]!.count).toBe(1);
    const currentSession = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: cookie! },
    });
    expect(await currentSession.json()).toMatchObject({ user: { id: adminId, role: "admin" } });

    const response = await fetch(`${baseUrl}/api/manager/bookings/${dayBookingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookie! },
      body: JSON.stringify({ status: "confirmed", adminNote: "Validation de test" }),
    });
    expect(response.status).toBe(200);
    const audit = await pool.query<{ admin_note: string; processed_by_user_id: string; processed_at: Date | null }>(
      `SELECT admin_note, processed_by_user_id, processed_at
       FROM bookings WHERE id = $1`,
      [dayBookingId],
    );
    expect(audit.rows[0]).toMatchObject({
      admin_note: "Validation de test",
      processed_by_user_id: adminId,
    });
    expect(audit.rows[0]!.processed_at).toBeInstanceOf(Date);
  }, 30_000);

  it("protège les inscriptions, chiffre les informations privées et respecte la jauge concurrente", async () => {
    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: "admin-integration-password" }),
    });
    const adminCookie = adminLogin.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(adminLogin.status).toBe(200);
    expect(adminCookie).toBeTruthy();

    const invalidSummerDeparture = await fetch(`${baseUrl}/api/admin/camp-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        season: "summer",
        ageGroup: "little",
        title: "Départ d'été hors période",
        startDate: "2030-09-28",
        registrationOpen: true,
      }),
    });
    expect(invalidSummerDeparture.status).toBe(400);

    const start = new Date("2030-07-10T00:00:00Z");
    const startDate = start.toISOString().slice(0, 10);
    const created = await fetch(`${baseUrl}/api/admin/camp-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        season: "summer",
        ageGroup: "little",
        title: `Départ intégration ${Date.now()}`,
        activities: "Randonnée organisée",
        startDate,
        registrationOpen: true,
      }),
    });
    expect(created.status).toBe(201);
    const createdSession = await created.json() as { session: { id: string; endDate: string; durationDays: number } };
    campSessionId = createdSession.session.id;
    expect(createdSession.session.durationDays).toBe(4);
    expect(createdSession.session.endDate).toBe(new Date(start.getTime() + 3 * 86_400_000).toISOString().slice(0, 10));

    await expect(pool.query(
      `INSERT INTO camp_sessions
         (season, age_group, title, start_date, end_date, duration_days, created_by_user_id)
       VALUES ('summer', 'little', 'Départ DB hors période', '2030-09-28', '2030-10-01', 4, $1)`,
      [adminId],
    )).rejects.toMatchObject({ code: "23514" });

    const customerOnly = await fetch(`${baseUrl}/api/admin/camp-sessions`, {
      headers: { cookie: registeredCookie },
    });
    expect(customerOnly.status).toBe(403);

    const seededEnrollment = await pool.query<{ id: string }>(
      `INSERT INTO camp_enrollments
         (camp_session_id, customer_user_id, health_data_consent_at, health_data_consent_version)
       VALUES ($1, $2, NOW(), 'v1') RETURNING id`,
      [campSessionId, registeredCustomerId],
    );
    for (let index = 0; index < 19; index += 1) {
      await pool.query(
        `INSERT INTO camp_participants
           (enrollment_id, first_name, last_name, birth_date, recommended_age_group)
         VALUES ($1, $2, 'Test', '2020-06-01', TRUE)`,
        [seededEnrollment.rows[0]!.id, `Participant ${index + 1}`],
      );
    }

    const lockedScheduleUpdate = await fetch(`${baseUrl}/api/admin/camp-sessions/${campSessionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ startDate: "2030-07-10" }),
    });
    expect(lockedScheduleUpdate.status).toBe(409);

    const activitiesUpdate = await fetch(`${baseUrl}/api/admin/camp-sessions/${campSessionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ activities: "Randonnée mise à jour" }),
    });
    expect(activitiesUpdate.status).toBe(200);

    const enrollmentBody = {
      healthDataConsent: true,
      participants: [{
        firstName: "Lou",
        lastName: "Martin",
        birthDate: "2020-06-01",
        dietaryRestrictions: "Allergie privée intégration",
        medicalInstructions: "Consigne confidentielle",
        specialRequests: "Demande confidentielle",
      }],
    };
    const createEnrollment = () => fetch(`${baseUrl}/api/camp-sessions/${campSessionId}/enrollments`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: registeredCookie },
      body: JSON.stringify(enrollmentBody),
    });
    const underageEnrollment = await fetch(`${baseUrl}/api/camp-sessions/${campSessionId}/enrollments`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: registeredCookie },
      body: JSON.stringify({
        ...enrollmentBody,
        participants: [{ ...enrollmentBody.participants[0], birthDate: "2026-07-11" }],
      }),
    });
    expect(underageEnrollment.status).toBe(400);

    const [first, second] = await Promise.all([createEnrollment(), createEnrollment()]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const successfulResponse = first.status === 201 ? first : second;
    const successfulEnrollmentId = (await successfulResponse.json() as { enrollment: { id: string } }).enrollment.id;

    const savedPrivateData = await pool.query<{ private_data_encrypted: string }>(
      `SELECT p.private_data_encrypted
       FROM camp_participants p WHERE p.enrollment_id = $1`,
      [successfulEnrollmentId],
    );
    expect(savedPrivateData.rows[0]!.private_data_encrypted).not.toContain("Allergie privée intégration");

    const publicSessions = await fetch(`${baseUrl}/api/camp-sessions`);
    const publicCatalog = await publicSessions.text();
    expect(publicCatalog).not.toContain("Allergie privée intégration");
    expect(publicCatalog).toContain('"reservedPlaces":20');
    expect(publicCatalog).toContain("Randonnée mise à jour");

    const ownEnrollments = await fetch(`${baseUrl}/api/camp-enrollments/mine`, {
      headers: { cookie: registeredCookie },
    });
    expect(ownEnrollments.status).toBe(200);
    expect(await ownEnrollments.text()).toContain("Allergie privée intégration");

    const adminEnrollments = await fetch(`${baseUrl}/api/admin/camp-enrollments`, {
      headers: { cookie: adminCookie },
    });
    expect(adminEnrollments.status).toBe(200);
    expect(await adminEnrollments.text()).toContain("Consigne confidentielle");

    const cancel = await fetch(`${baseUrl}/api/admin/camp-enrollments/${successfulEnrollmentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(cancel.status).toBe(200);
    const remaining = await pool.query<{ reserved_places: number }>(
      "SELECT reserved_places FROM camp_sessions WHERE id = $1",
      [campSessionId],
    );
    expect(remaining.rows[0]!.reserved_places).toBe(19);
  }, 30_000);

  it("masque puis efface les données privées à la fin du séjour", async () => {
    const { purgeExpiredCampPrivateData } = await import("./camp-private-data-retention.js");
    const { encryptParticipantPrivateData } = await import("./security/health-data.js");
    const year = new Date().getUTCFullYear();
    const privateDataBySession = new Map<string, string>();
    const endedSession = await pool.query<{ id: string }>(
      `INSERT INTO camp_sessions
         (season, age_group, title, start_date, end_date, duration_days, created_by_user_id)
       VALUES ('summer', 'little', 'Séjour terminé pour test', $1::date, $1::date + 3, 4, $2)
       RETURNING id`,
      [`${year - 1}-05-10`, adminId],
    );
    const activeSession = await pool.query<{ id: string }>(
      `INSERT INTO camp_sessions
         (season, age_group, title, start_date, end_date, duration_days, created_by_user_id)
       VALUES ('winter', 'little', 'Séjour futur pour test', $1::date, $1::date + 3, 4, $2)
       RETURNING id`,
      [`${year + 1}-01-15`, adminId],
    );
    retentionSessionIds.push(endedSession.rows[0]!.id, activeSession.rows[0]!.id);

    for (const sessionId of retentionSessionIds) {
      const enrollment = await pool.query<{ id: string }>(
        `INSERT INTO camp_enrollments
           (camp_session_id, customer_user_id, health_data_consent_at, health_data_consent_version)
         VALUES ($1, $2, NOW(), 'v1') RETURNING id`,
        [sessionId, registeredCustomerId],
      );
      retentionEnrollmentIds.push(enrollment.rows[0]!.id);
      const privateData = encryptParticipantPrivateData({
        dietaryRestrictions: `Allergie ${sessionId}`,
        medicalInstructions: `Traitement ${sessionId}`,
        specialRequests: `Demande ${sessionId}`,
      });
      privateDataBySession.set(sessionId, privateData);
      await pool.query(
        `INSERT INTO camp_participants
           (enrollment_id, first_name, last_name, birth_date, recommended_age_group, private_data_encrypted)
         VALUES ($1, 'Participant', 'Test', '2020-06-01', TRUE, $2)`,
        [enrollment.rows[0]!.id, privateData],
      );
    }

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: "admin-integration-password" }),
    });
    expect(login.status).toBe(200);
    const adminCookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    const adminResponse = await fetch(`${baseUrl}/api/admin/camp-enrollments`, {
      headers: { cookie: adminCookie },
    });
    const adminBody = await adminResponse.text();
    expect(adminResponse.status).toBe(200);
    expect(adminBody).not.toContain(`Allergie ${endedSession.rows[0]!.id}`);
    expect(adminBody).toContain(`Allergie ${activeSession.rows[0]!.id}`);

    const customerResponse = await fetch(`${baseUrl}/api/camp-enrollments/mine`, {
      headers: { cookie: registeredCookie },
    });
    const customerBody = await customerResponse.text();
    expect(customerResponse.status).toBe(200);
    expect(customerBody).not.toContain(`Allergie ${endedSession.rows[0]!.id}`);
    expect(customerBody).toContain(`Allergie ${activeSession.rows[0]!.id}`);

    expect(await purgeExpiredCampPrivateData()).toBe(1);
    const savedData = await pool.query<{ enrollment_id: string; private_data_encrypted: string | null }>(
      `SELECT enrollment_id, private_data_encrypted FROM camp_participants WHERE enrollment_id = ANY($1::uuid[])`,
      [retentionEnrollmentIds],
    );
    expect(Object.fromEntries(savedData.rows.map((row) => [row.enrollment_id, row.private_data_encrypted]))).toEqual({
      [retentionEnrollmentIds[0]!]: null,
      [retentionEnrollmentIds[1]!]: privateDataBySession.get(activeSession.rows[0]!.id),
    });
  }, 30_000);
});
