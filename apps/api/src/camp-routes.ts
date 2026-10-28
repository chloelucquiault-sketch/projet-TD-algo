import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "./db/pool.js";
import { HttpError } from "./errors.js";
import { requireRole } from "./middleware/auth.js";
import {
  ageOnDate,
  campEnrollmentSchema,
  createCampSessionSchema,
  currentDateInParis,
  isCampSeasonDateRangeValid,
  updateCampSessionSchema,
} from "./camp-validation.js";
import { decryptParticipantPrivateData, encryptParticipantPrivateData } from "./security/health-data.js";

const router = Router();
const idSchema = z.string().uuid();
const daysByAgeGroup = { little: 4, middle: 7, teen: 7, adult: 7 } as const;
const recommendedAgeRanges = {
  little: [5, 7],
  middle: [7, 12],
  teen: [12, 14],
  adult: [15, Number.POSITIVE_INFINITY],
} as const;
const consentVersion = "v1";
const enrollmentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({
      error: { code: "RATE_LIMITED", message: "Trop de demandes d'inscription. Réessaie dans quelques minutes." },
    });
  },
});

function dateOnly(value: string | Date) {
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function presentParticipant(row: {
  id: string;
  enrollment_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | Date;
  recommended_age_group: boolean;
  private_data_encrypted: string | null;
}) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: dateOnly(row.birth_date),
    matchesRecommendedAge: row.recommended_age_group,
    ...decryptParticipantPrivateData(row.private_data_encrypted),
  };
}

async function loadParticipants(enrollmentIds: string[]) {
  if (!enrollmentIds.length) return new Map<string, ReturnType<typeof presentParticipant>[]>();
  const result = await pool.query<Parameters<typeof presentParticipant>[0]>(
    `SELECT participant.id, participant.enrollment_id, participant.first_name, participant.last_name,
            participant.birth_date, participant.recommended_age_group,
            CASE
              WHEN camp_session.end_date >= (NOW() AT TIME ZONE 'Europe/Paris')::date
              THEN participant.private_data_encrypted
              ELSE NULL
            END AS private_data_encrypted
     FROM camp_participants AS participant
     JOIN camp_enrollments AS enrollment ON enrollment.id = participant.enrollment_id
     JOIN camp_sessions AS camp_session ON camp_session.id = enrollment.camp_session_id
     WHERE participant.enrollment_id = ANY($1::uuid[])
     ORDER BY participant.created_at, participant.id`,
    [enrollmentIds],
  );
  const participants = new Map<string, ReturnType<typeof presentParticipant>[]>();
  for (const row of result.rows) {
    const list = participants.get(row.enrollment_id) ?? [];
    list.push(presentParticipant(row));
    participants.set(row.enrollment_id, list);
  }
  return participants;
}

async function enrollmentRows(where: string, values: unknown[] = []) {
  return pool.query<{
    id: string;
    camp_session_id: string;
    customer_user_id: string;
    status: "pending" | "confirmed" | "cancelled";
    health_data_consent_at: Date;
    admin_note: string | null;
    created_at: Date;
    processed_at: Date | null;
    processor_name: string | null;
    customer_name: string;
    customer_email: string;
    title: string;
    season: "summer" | "winter";
    age_group: "little" | "middle" | "teen" | "adult";
    start_date: string | Date;
    end_date: string | Date;
  }>(
    `SELECT e.id, e.camp_session_id, e.customer_user_id, e.status,
            e.health_data_consent_at, e.admin_note, e.created_at, e.processed_at,
            processor.full_name AS processor_name,
            customer.full_name AS customer_name, customer.email AS customer_email,
            s.title, s.season, s.age_group, s.start_date, s.end_date
     FROM camp_enrollments e
     JOIN camp_sessions s ON s.id = e.camp_session_id
     JOIN users customer ON customer.id = e.customer_user_id
     LEFT JOIN users processor ON processor.id = e.processed_by_user_id
     ${where}
     ORDER BY e.created_at DESC`,
    values,
  );
}

router.get("/api/camp-sessions", async (_request, response) => {
  const result = await pool.query(
    `SELECT id, season, age_group AS "ageGroup", title, description,
          activities,
            start_date AS "startDate", end_date AS "endDate", duration_days AS "durationDays",
            capacity, reserved_places AS "reservedPlaces",
            capacity - reserved_places AS "remainingPlaces"
     FROM camp_sessions
     WHERE registration_open = TRUE AND start_date >= CURRENT_DATE
     ORDER BY start_date, age_group, title`,
  );
  response.json({
    sessions: result.rows.map((row) => ({
      ...row,
      startDate: dateOnly(row.startDate),
      endDate: dateOnly(row.endDate),
    })),
  });
});

router.post("/api/camp-sessions/:id/enrollments", requireRole("customer"), enrollmentRateLimit, async (request, response) => {
  const sessionId = idSchema.parse(request.params.id);
  const input = campEnrollmentSchema.parse(request.body);
  const client = await pool.connect();
  let enrollmentId = "";
  try {
    await client.query("BEGIN");
    const sessionResult = await client.query<{
      age_group: keyof typeof recommendedAgeRanges;
      start_date: string | Date;
      registration_open: boolean;
      remaining_places: number;
    }>(
      `SELECT age_group, start_date, registration_open,
              capacity - reserved_places AS remaining_places
       FROM camp_sessions WHERE id = $1 FOR UPDATE`,
      [sessionId],
    );
    const campSession = sessionResult.rows[0];
    if (!campSession) throw new HttpError(404, "Ce départ n'existe pas.");
    const startDate = dateOnly(campSession.start_date);
    if (!campSession.registration_open || startDate < currentDateInParis()) {
      throw new HttpError(409, "Les inscriptions à ce départ sont fermées.");
    }
    if (input.participants.length > campSession.remaining_places) {
      throw new HttpError(409, `Il ne reste que ${campSession.remaining_places} place(s) pour ce départ.`);
    }
    if (input.participants.some((participant) => ageOnDate(participant.birthDate, startDate) < 5)) {
      throw new HttpError(400, "Chaque participant doit avoir au moins 5 ans au début du séjour.");
    }

    const enrollmentResult = await client.query<{ id: string }>(
      `INSERT INTO camp_enrollments (camp_session_id, customer_user_id, health_data_consent_at, health_data_consent_version)
       VALUES ($1, $2, NOW(), $3)
       RETURNING id`,
      [sessionId, request.user!.id, consentVersion],
    );
    enrollmentId = enrollmentResult.rows[0]!.id;

    const [minimumAge, maximumAge] = recommendedAgeRanges[campSession.age_group];
    for (const participant of input.participants) {
      if (participant.birthDate > startDate) {
        throw new HttpError(400, "La date de naissance doit précéder le début du séjour.");
      }
      const age = ageOnDate(participant.birthDate, startDate);
      await client.query(
        `INSERT INTO camp_participants
           (enrollment_id, first_name, last_name, birth_date, recommended_age_group, private_data_encrypted)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          enrollmentId,
          participant.firstName,
          participant.lastName,
          participant.birthDate,
          age >= minimumAge && age <= maximumAge,
          encryptParticipantPrivateData({
            dietaryRestrictions: participant.dietaryRestrictions,
            medicalInstructions: participant.medicalInstructions,
            specialRequests: participant.specialRequests,
          }),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { constraint?: string }).constraint === "camp_session_capacity") {
      throw new HttpError(409, "Il n'y a plus assez de places disponibles pour ce départ.");
    }
    throw error;
  } finally {
    client.release();
  }
  response.status(201).json({ enrollment: { id: enrollmentId, status: "pending" } });
});

router.get("/api/camp-enrollments/mine", requireRole("customer"), async (request, response) => {
  const result = await enrollmentRows("WHERE e.customer_user_id = $1", [request.user!.id]);
  const participants = await loadParticipants(result.rows.map((row) => row.id));
  response.json({
    enrollments: result.rows.map((row) => ({
      id: row.id,
      status: row.status,
      adminNote: row.admin_note,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      consentRecordedAt: row.health_data_consent_at,
      session: {
        id: row.camp_session_id,
        title: row.title,
        season: row.season,
        ageGroup: row.age_group,
        startDate: dateOnly(row.start_date),
        endDate: dateOnly(row.end_date),
      },
      participants: participants.get(row.id) ?? [],
    })),
  });
});

router.get("/api/admin/camp-sessions", requireRole("admin"), async (_request, response) => {
  const result = await pool.query(
    `SELECT id, season, age_group AS "ageGroup", title, description, activities,
            start_date AS "startDate", end_date AS "endDate", duration_days AS "durationDays",
            capacity, reserved_places AS "reservedPlaces",
            capacity - reserved_places AS "remainingPlaces", registration_open AS "registrationOpen",
            EXISTS (SELECT 1 FROM camp_enrollments e WHERE e.camp_session_id = camp_sessions.id) AS "hasEnrollments"
     FROM camp_sessions
     ORDER BY start_date DESC, created_at DESC`,
  );
  response.json({
    sessions: result.rows.map((row) => ({
      ...row,
      startDate: dateOnly(row.startDate),
      endDate: dateOnly(row.endDate),
    })),
  });
});

router.post("/api/admin/camp-sessions", requireRole("admin"), async (request, response) => {
  const input = createCampSessionSchema.parse(request.body);
  const durationDays = daysByAgeGroup[input.ageGroup];
  const result = await pool.query<{ id: string; end_date: string }>(
    `INSERT INTO camp_sessions
       (season, age_group, title, description, activities, start_date, end_date, duration_days, registration_open, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6::date, $6::date + ($7 - 1), $7, $8, $9)
     RETURNING id, end_date`,
    [
      input.season,
      input.ageGroup,
      input.title,
      input.description,
      input.activities,
      input.startDate,
      durationDays,
      input.registrationOpen,
      request.user!.id,
    ],
  );
  response.status(201).json({
    session: { id: result.rows[0]!.id, endDate: dateOnly(result.rows[0]!.end_date), durationDays },
  });
});

router.patch("/api/admin/camp-sessions/:id", requireRole("admin"), async (request, response) => {
  const sessionId = idSchema.parse(request.params.id);
  const input = updateCampSessionSchema.parse(request.body);
  const client = await pool.connect();
  let endDate: string | null = null;
  try {
    await client.query("BEGIN");
    const existing = await client.query<{
      age_group: keyof typeof daysByAgeGroup;
      season: string;
      start_date: string | Date;
      registration_open: boolean;
      title: string;
      description: string;
      activities: string;
      has_enrollments: boolean;
    }>(
      `SELECT s.age_group, s.season, s.start_date, s.registration_open, s.title, s.description, s.activities,
              EXISTS (SELECT 1 FROM camp_enrollments e WHERE e.camp_session_id = s.id) AS has_enrollments
       FROM camp_sessions s WHERE s.id = $1 FOR UPDATE`,
      [sessionId],
    );
    const session = existing.rows[0];
    if (!session) throw new HttpError(404, "Ce départ n'existe pas.");

    const scheduleChanged = input.startDate !== undefined
      || input.ageGroup !== undefined
      || input.season !== undefined;
    if (scheduleChanged && session.has_enrollments) {
      throw new HttpError(409, "Les dates, la saison et la tranche d'âge ne peuvent plus changer après une inscription.");
    }
    const ageGroup = input.ageGroup ?? session.age_group;
    const season = input.season ?? session.season as "summer" | "winter";
    const startDate = input.startDate ?? dateOnly(session.start_date);
    const durationDays = daysByAgeGroup[ageGroup];
    const endDateCandidate = new Date(Date.parse(`${startDate}T00:00:00Z`) + (durationDays - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    if (!isCampSeasonDateRangeValid(season, startDate, endDateCandidate)) {
      throw new HttpError(
        400,
        season === "summer"
          ? "Un séjour d'été doit se dérouler entre le 10 mai et le 30 septembre."
          : "Un séjour d'hiver doit se dérouler entre le 15 décembre et le 31 mars.",
      );
    }
    const registrationOpen = input.registrationOpen ?? session.registration_open;
    if (registrationOpen && startDate < currentDateInParis()) {
      throw new HttpError(400, "Impossible d'ouvrir les inscriptions pour un séjour déjà commencé.");
    }
    const updated = await client.query<{ end_date: string }>(
      `UPDATE camp_sessions SET
         season = $2,
         age_group = $3,
         title = COALESCE($4, title),
         description = COALESCE($5, description),
         activities = COALESCE($6, activities),
         start_date = $7::date,
         end_date = $7::date + ($8 - 1),
         duration_days = $8,
         registration_open = $9
       WHERE id = $1
       RETURNING end_date`,
      [
        sessionId,
        season,
        ageGroup,
        input.title ?? null,
        input.description ?? null,
        input.activities ?? null,
        startDate,
        durationDays,
        registrationOpen,
      ],
    );
    endDate = updated.rows[0]!.end_date;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.json({ session: { id: sessionId, endDate: endDate && dateOnly(endDate) } });
});

router.get("/api/admin/camp-enrollments", requireRole("admin"), async (_request, response) => {
  const result = await enrollmentRows("");
  const participants = await loadParticipants(result.rows.map((row) => row.id));
  response.json({
    enrollments: result.rows.map((row) => ({
      id: row.id,
      status: row.status,
      adminNote: row.admin_note,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      processedBy: row.processor_name,
      consentRecordedAt: row.health_data_consent_at,
      customer: { id: row.customer_user_id, name: row.customer_name, email: row.customer_email },
      session: {
        id: row.camp_session_id,
        title: row.title,
        season: row.season,
        ageGroup: row.age_group,
        startDate: dateOnly(row.start_date),
        endDate: dateOnly(row.end_date),
      },
      participants: participants.get(row.id) ?? [],
    })),
  });
});

router.patch("/api/admin/camp-enrollments/:id", requireRole("admin"), async (request, response) => {
  const enrollmentId = idSchema.parse(request.params.id);
  const input = z.object({
    status: z.enum(["confirmed", "cancelled"]),
    adminNote: z.string().trim().max(1000).nullable().optional(),
  }).parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ status: string }>(
      "SELECT status FROM camp_enrollments WHERE id = $1 FOR UPDATE",
      [enrollmentId],
    );
    if (!existing.rowCount) throw new HttpError(404, "Cette inscription n'existe pas.");
    if (existing.rows[0]!.status !== "pending") {
      throw new HttpError(409, "Seules les inscriptions en attente peuvent être traitées.");
    }
    await client.query(
      `UPDATE camp_enrollments
       SET status = $2, admin_note = $3, processed_by_user_id = $4,
           processed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [enrollmentId, input.status, input.adminNote ?? null, request.user!.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.json({ enrollment: { id: enrollmentId, status: input.status } });
});

export default router;
