import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "./db/pool.js";
import { HttpError } from "./errors.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { bookingSchema, dayDateSchema, registerSchema, stayDatesSchema } from "./validation.js";

const router = Router();
const idSchema = z.string().uuid();
const statusSchema = z.object({
  status: z.enum(["confirmed", "cancelled"]),
  adminNote: z.string().trim().max(1000).optional(),
});

const parseId = (value: unknown) => idSchema.parse(value);

function requireSession(request: Request) {
  if (!request.session) {
    throw new HttpError(503, "La session est indisponible. Réessaie dans quelques instants.");
  }
  return request.session;
}

async function startUserSession(request: Request, userId: string) {
  const userSession = requireSession(request);
  await new Promise<void>((resolve, reject) => {
    userSession.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  userSession.userId = userId;
  await new Promise<void>((resolve, reject) => {
    userSession.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

router.get("/health", async (_request, response) => {
  await pool.query("SELECT 1");
  response.json({ status: "ok" });
});

router.get("/api/auth/me", (request, response) => {
  response.json({ user: request.user ?? null });
});

router.post("/api/auth/register", async (request, response) => {
  requireSession(request);
  const input = registerSchema.parse(request.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, organization_name, role)
       VALUES ($1, $2, $3, $4, 'customer')
       RETURNING id`,
      [input.email, passwordHash, input.fullName, input.organizationName ?? null],
    );
    await startUserSession(request, result.rows[0]!.id);
    response.status(201).json({
      user: { id: result.rows[0]!.id, email: input.email, fullName: input.fullName, role: "customer" },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new HttpError(409, "Un compte existe déjà avec cette adresse e-mail.");
    }
    throw error;
  }
});

router.post("/api/auth/login", async (request, response) => {
  requireSession(request);
  const input = z.object({
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(200),
  }).parse(request.body);
  const result = await pool.query<{
    id: string;
    email: string;
    full_name: string;
    role: "customer" | "admin";
    password_hash: string;
  }>(
    "SELECT id, email, full_name, role, password_hash FROM users WHERE email = $1",
    [input.email],
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw new HttpError(401, "Adresse e-mail ou mot de passe incorrect.");
  }
  await startUserSession(request, user.id);
  response.json({
    user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
  });
});

router.post("/api/auth/logout", requireAuth, (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    response.clearCookie("sid");
    response.status(204).end();
  });
});

router.get("/api/sports", async (_request, response) => {
  const result = await pool.query("SELECT id, name, slug FROM sports ORDER BY name");
  response.json({ sports: result.rows });
});

router.get("/api/complexes", async (request, response) => {
  const filters = z.object({
    region: z.string().trim().max(100).optional(),
    sport: z.string().trim().max(80).optional(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    capacity: z.coerce.number().int().min(1).max(500).optional(),
  }).parse(request.query);
  const dates = filters.checkIn || filters.checkOut
    ? stayDatesSchema.parse({ checkIn: filters.checkIn, checkOut: filters.checkOut })
    : null;
  const values: unknown[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  const conditions = ["c.is_published = TRUE"];
  if (filters.region) conditions.push(`c.region ILIKE ${bind(`%${filters.region}%`)}`);
  if (filters.sport) {
    const sport = bind(filters.sport);
    let availability = "";
    if (dates) {
      const checkIn = bind(dates.checkIn);
      const checkOut = bind(dates.checkOut);
      availability = `AND NOT EXISTS (
        SELECT 1 FROM booking_facilities bf
        JOIN bookings b ON b.id = bf.booking_id
        WHERE bf.facility_id = f.id AND b.status IN ('pending', 'confirmed')
          AND b.check_in < ${checkOut}::date AND b.check_out > ${checkIn}::date
      )`;
    }
    conditions.push(`EXISTS (
      SELECT 1 FROM facilities f
      JOIN facility_sports fs ON fs.facility_id = f.id
      JOIN sports s ON s.id = fs.sport_id
      WHERE f.complex_id = c.id AND f.is_active = TRUE AND s.slug = ${sport}
      ${availability}
    )`);
  } else if (dates) {
    const checkIn = bind(dates.checkIn);
    const checkOut = bind(dates.checkOut);
    conditions.push(`EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.complex_id = c.id AND f.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM booking_facilities bf
          JOIN bookings b ON b.id = bf.booking_id
          WHERE bf.facility_id = f.id AND b.status IN ('pending', 'confirmed')
            AND b.check_in < ${checkOut}::date AND b.check_out > ${checkIn}::date
        )
    )`);
  }

  let capacityExpression = `COALESCE((
    SELECT SUM(d.bed_count)
    FROM dormitories d
    WHERE d.complex_id = c.id AND d.is_active = TRUE
  ), 0)`;
  if (dates) {
    const checkIn = bind(dates.checkIn);
    const checkOut = bind(dates.checkOut);
    capacityExpression = `COALESCE((
      SELECT SUM(d.bed_count - COALESCE((
        SELECT SUM(bd.beds_reserved)
        FROM booking_dormitories bd
        JOIN bookings b ON b.id = bd.booking_id
        WHERE bd.dormitory_id = d.id AND b.status IN ('pending', 'confirmed')
          AND b.check_in < ${checkOut}::date AND b.check_out > ${checkIn}::date
      ), 0))
      FROM dormitories d
      WHERE d.complex_id = c.id AND d.is_active = TRUE
    ), 0)`;
  }
  if (filters.capacity) conditions.push(`${capacityExpression} >= ${bind(filters.capacity)}`);
  const result = await pool.query(
    `SELECT c.id, c.name, c.description, c.region, c.address, c.image_url,
            (${capacityExpression})::int AS available_beds,
            (SELECT COUNT(*)::int FROM facilities f WHERE f.complex_id = c.id AND f.is_active = TRUE) AS facility_count
     FROM complexes c
     WHERE ${conditions.join(" AND ")}
     ORDER BY c.name`,
    values,
  );
  response.json({ complexes: result.rows });
});

router.get("/api/complexes/:id", async (request, response) => {
  const id = parseId(request.params.id);
  const complexResult = await pool.query(
    `SELECT c.id, c.name, c.description, c.region, c.address, c.image_url
     FROM complexes c WHERE c.id = $1 AND c.is_published = TRUE`,
    [id],
  );
  const complex = complexResult.rows[0];
  if (!complex) throw new HttpError(404, "Ce complexe n'a pas été trouvé.");
  const [facilities, dormitories, meals] = await Promise.all([
    pool.query(
      `SELECT f.id, f.name, f.facility_type AS "facilityType", f.description,
              ARRAY_AGG(s.id ORDER BY s.name) AS "sportIds",
              ARRAY_AGG(s.name ORDER BY s.name) AS "sportNames",
              ARRAY_AGG(s.slug ORDER BY s.name) AS "sportSlugs"
       FROM facilities f
       JOIN facility_sports fs ON fs.facility_id = f.id
       JOIN sports s ON s.id = fs.sport_id
       WHERE f.complex_id = $1 AND f.is_active = TRUE
       GROUP BY f.id ORDER BY f.name`,
      [id],
    ),
    pool.query(
      `SELECT id, name, description, bed_count AS "bedCount"
       FROM dormitories WHERE complex_id = $1 AND is_active = TRUE ORDER BY name`,
      [id],
    ),
    pool.query(
      `SELECT id, name, description FROM meal_options
       WHERE complex_id = $1 AND is_active = TRUE ORDER BY name`,
      [id],
    ),
  ]);
  response.json({
    complex,
    facilities: facilities.rows,
    dormitories: dormitories.rows,
    mealOptions: meals.rows,
  });
});

router.get("/api/complexes/:id/availability", async (request, response) => {
  const complexId = parseId(request.params.id);
  const input = z.object({
    checkIn: z.string(),
    checkOut: z.string(),
    groupSize: z.coerce.number().int().min(1).max(500),
    facilityIds: z.string().min(1).transform((value) => value.split(",")).pipe(z.array(z.string().uuid()).min(1).max(20)),
  }).parse(request.query);
  const dates = stayDatesSchema.parse(input);
  const complex = await pool.query("SELECT 1 FROM complexes WHERE id = $1 AND is_published = TRUE", [complexId]);
  if (!complex.rowCount) throw new HttpError(404, "Ce complexe n'a pas été trouvé.");

  const facilities = await pool.query(
    `SELECT f.id FROM facilities f
     WHERE f.complex_id = $1 AND f.id = ANY($2::uuid[]) AND f.is_active = TRUE
       AND NOT EXISTS (
         SELECT 1
         FROM booking_facilities bf JOIN bookings b ON b.id = bf.booking_id
         WHERE bf.facility_id = f.id AND b.status IN ('pending', 'confirmed')
           AND b.check_in < $4::date AND b.check_out > $3::date
       )`,
    [complexId, input.facilityIds, dates.checkIn, dates.checkOut],
  );
  const beds = await pool.query<{ id: string; name: string; available_beds: number }>(
    `SELECT d.id, d.name,
            (d.bed_count - COALESCE((
       SELECT SUM(bd.beds_reserved)
       FROM booking_dormitories bd
       JOIN bookings b ON b.id = bd.booking_id
       WHERE bd.dormitory_id = d.id AND b.status IN ('pending', 'confirmed')
         AND b.check_in < $3::date AND b.check_out > $2::date
     ), 0))::int AS available_beds
     FROM dormitories d
     WHERE d.complex_id = $1 AND d.is_active = TRUE ORDER BY d.name`,
    [complexId, dates.checkIn, dates.checkOut],
  );
  const availableBeds = beds.rows.reduce((total, dormitory) => total + dormitory.available_beds, 0);
  const isAvailable = facilities.rowCount === input.facilityIds.length && availableBeds >= input.groupSize;
  response.json({
    available: isAvailable,
    availableBeds,
    dormitories: beds.rows,
    message: isAvailable
      ? "Les équipements et les couchages sont disponibles à cet instant. Ils seront vérifiés à nouveau lors de l'envoi."
      : "Les dates, équipements ou couchages sélectionnés ne sont pas tous disponibles.",
  });
});

router.get("/api/complexes/:id/day-availability", async (request, response) => {
  const complexId = parseId(request.params.id);
  const input = z.object({
    date: dayDateSchema,
    facilityId: z.string().uuid(),
  }).parse(request.query);
  const complex = await pool.query(
    "SELECT 1 FROM complexes WHERE id = $1 AND is_published = TRUE",
    [complexId],
  );
  if (!complex.rowCount) throw new HttpError(404, "Ce complexe n'a pas été trouvé.");
  const facility = await pool.query(
    "SELECT 1 FROM facilities WHERE id = $1 AND complex_id = $2 AND is_active = TRUE",
    [input.facilityId, complexId],
  );
  if (!facility.rowCount) throw new HttpError(404, "Cette infrastructure n'est pas disponible.");

  const [bookedSlots, stayConflict] = await Promise.all([
    pool.query<{ start_time: string; end_time: string }>(
      `SELECT to_char(s.start_time, 'HH24:MI') AS start_time,
              to_char(s.end_time, 'HH24:MI') AS end_time
       FROM booking_day_slots s
       JOIN bookings b ON b.id = s.booking_id
       WHERE s.facility_id = $1 AND s.slot_date = $2
         AND b.status IN ('pending', 'confirmed')`,
      [input.facilityId, input.date],
    ),
    pool.query(
      `SELECT 1 FROM booking_facilities bf
       JOIN bookings b ON b.id = bf.booking_id
       WHERE bf.facility_id = $1 AND b.booking_type = 'stay'
         AND b.status IN ('pending', 'confirmed')
         AND b.check_in <= $2::date AND b.check_out > $2::date
       LIMIT 1`,
      [input.facilityId, input.date],
    ),
  ]);
  const toMinutes = (value: string) => {
    const hours = Number(value.slice(0, 2));
    const minutes = Number(value.slice(3, 5));
    return hours * 60 + minutes;
  };
  const starts = Array.from({ length: 19 }, (_, index) => {
    const minutes = 8 * 60 + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
  const slots = starts.map((startTime) => {
    const start = toMinutes(startTime);
    const available = !stayConflict.rowCount && !bookedSlots.rows.some((slot) => (
      toMinutes(slot.start_time) < start + 210
      && toMinutes(slot.end_time) + 30 > start
    ));
    return { startTime, available };
  });
  response.json({
    slots,
    message: "La disponibilité est indicative et sera vérifiée à nouveau lors de l'envoi.",
  });
});

router.post("/api/bookings", requireRole("customer"), async (request, response) => {
  const input = bookingSchema.parse(request.body);
  const client = await pool.connect();
  let bookingId: string;
  try {
    await client.query("BEGIN");
    const complexResult = await client.query<{ id: string; is_published: boolean }>(
      "SELECT id, is_published FROM complexes WHERE id = $1 FOR UPDATE",
      [input.complexId],
    );
    if (!complexResult.rows[0]?.is_published) throw new HttpError(404, "Ce complexe n'est pas disponible.");

    if (input.bookingType === "day") {
      const facility = await client.query<{ id: string }>(
        `SELECT id FROM facilities
         WHERE id = $1 AND complex_id = $2 AND is_active = TRUE
         FOR UPDATE`,
        [input.facilityId, input.complexId],
      );
      if (!facility.rowCount) throw new HttpError(409, "Cette infrastructure n'est plus disponible.");

      const stayConflict = await client.query(
        `SELECT 1 FROM booking_facilities bf
         JOIN bookings b ON b.id = bf.booking_id
         WHERE bf.facility_id = $1 AND b.booking_type = 'stay'
           AND b.status IN ('pending', 'confirmed')
           AND b.check_in <= $2::date AND b.check_out > $2::date
         LIMIT 1`,
        [input.facilityId, input.checkIn],
      );
      if (stayConflict.rowCount) {
        throw new HttpError(409, "Cette infrastructure est déjà réservée pour un séjour à cette date.");
      }

      for (const startTime of input.startTimes) {
        const conflict = await client.query(
          `SELECT 1 FROM booking_day_slots s
           JOIN bookings b ON b.id = s.booking_id
           WHERE s.facility_id = $1 AND s.slot_date = $2::date
             AND b.status IN ('pending', 'confirmed')
             AND s.start_time < $3::time + INTERVAL '3 hours 30 minutes'
             AND s.end_time + INTERVAL '30 minutes' > $3::time
           LIMIT 1`,
          [input.facilityId, input.checkIn, startTime],
        );
        if (conflict.rowCount) {
          throw new HttpError(409, `Le créneau de ${startTime} n'est plus disponible avec le délai de 30 minutes.`);
        }
      }

      const created = await client.query<{ id: string }>(
        `INSERT INTO bookings
         (complex_id, customer_user_id, check_in, check_out, group_size, group_type, booking_type)
         VALUES ($1, $2, $3::date, $3::date + 1, $4, $5, 'day')
         RETURNING id`,
        [input.complexId, request.user!.id, input.checkIn, input.groupSize, input.groupType],
      );
      bookingId = created.rows[0]!.id;
      await client.query(
        "INSERT INTO booking_facilities (booking_id, facility_id) VALUES ($1, $2)",
        [bookingId, input.facilityId],
      );
      for (const startTime of input.startTimes) {
        await client.query(
          `INSERT INTO booking_day_slots (booking_id, facility_id, slot_date, start_time, end_time)
           VALUES ($1, $2, $3, $4::time, $4::time + INTERVAL '3 hours')`,
          [bookingId, input.facilityId, input.checkIn, startTime],
        );
      }
      await client.query("COMMIT");
      response.status(201).json({ booking: { id: bookingId, status: "pending" } });
      return;
    }

    const facilities = await client.query<{ id: string }>(
      `SELECT id FROM facilities
       WHERE complex_id = $1 AND id = ANY($2::uuid[]) AND is_active = TRUE
       FOR UPDATE`,
      [input.complexId, input.facilityIds],
    );
    if (facilities.rowCount !== input.facilityIds.length) {
      throw new HttpError(409, "Un ou plusieurs équipements ne sont plus disponibles dans ce complexe.");
    }
    const conflict = await client.query(
      `SELECT 1
       FROM booking_facilities bf JOIN bookings b ON b.id = bf.booking_id
       WHERE bf.facility_id = ANY($1::uuid[])
         AND b.status IN ('pending', 'confirmed')
         AND b.check_in < $3::date AND b.check_out > $2::date
       LIMIT 1`,
      [input.facilityIds, input.checkIn, input.checkOut],
    );
    if (conflict.rowCount) throw new HttpError(409, "Un équipement sélectionné vient d'être réservé sur ces dates.");

    const requestedDormIds = input.dormitories.map((entry) => entry.dormitoryId);
    const dorms = await client.query<{ id: string; bed_count: number; reserved: string }>(
      `SELECT d.id, d.bed_count,
              COALESCE((
                SELECT SUM(bd.beds_reserved)
                FROM booking_dormitories bd
                JOIN bookings b ON b.id = bd.booking_id
                WHERE bd.dormitory_id = d.id AND b.status IN ('pending', 'confirmed')
                  AND b.check_in < $3::date AND b.check_out > $2::date
              ), 0)::text AS reserved
       FROM dormitories d
       WHERE d.complex_id = $1 AND d.id = ANY($4::uuid[]) AND d.is_active = TRUE
       FOR UPDATE`,
      [input.complexId, input.checkIn, input.checkOut, requestedDormIds],
    );
    if (dorms.rowCount !== requestedDormIds.length) {
      throw new HttpError(409, "Un dortoir sélectionné n'est plus disponible.");
    }
    const bedsByDorm = new Map(input.dormitories.map((entry) => [entry.dormitoryId, entry.bedsReserved]));
    for (const dorm of dorms.rows) {
      const requested = bedsByDorm.get(dorm.id) ?? 0;
      if (requested > dorm.bed_count - Number(dorm.reserved)) {
        throw new HttpError(409, "Il ne reste pas assez de couchages dans un dortoir sélectionné.");
      }
    }
    if (input.mealOptionId) {
      const meal = await client.query(
        "SELECT 1 FROM meal_options WHERE id = $1 AND complex_id = $2 AND is_active = TRUE",
        [input.mealOptionId, input.complexId],
      );
      if (!meal.rowCount) throw new HttpError(409, "Cette option de restauration n'est plus disponible.");
    }

    const created = await client.query<{ id: string }>(
      `INSERT INTO bookings
       (complex_id, customer_user_id, check_in, check_out, group_size, group_type, meal_option_id, booking_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'stay') RETURNING id`,
      [
        input.complexId,
        request.user!.id,
        input.checkIn,
        input.checkOut,
        input.groupSize,
        input.groupType,
        input.mealOptionId,
      ],
    );
    bookingId = created.rows[0]!.id;
    for (const facilityId of input.facilityIds) {
      await client.query(
        "INSERT INTO booking_facilities (booking_id, facility_id) VALUES ($1, $2)",
        [bookingId, facilityId],
      );
    }
    for (const dormitory of input.dormitories) {
      await client.query(
        `INSERT INTO booking_dormitories (booking_id, dormitory_id, beds_reserved)
         VALUES ($1, $2, $3)`,
        [bookingId, dormitory.dormitoryId, dormitory.bedsReserved],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.status(201).json({ booking: { id: bookingId, status: "pending" } });
});

router.get("/api/bookings/mine", requireRole("customer"), async (request, response) => {
  const result = await pool.query(
    `SELECT b.id, b.booking_type AS "bookingType",
            b.check_in AS "checkIn", b.check_out AS "checkOut",
            b.group_size AS "groupSize", b.group_type AS "groupType",
            b.status, b.created_at AS "createdAt", c.name AS "complexName",
            mo.name AS "mealOption",
            COALESCE((
              SELECT json_agg(to_char(s.start_time, 'HH24:MI') ORDER BY s.start_time)
              FROM booking_day_slots s WHERE s.booking_id = b.id
            ), '[]'::json) AS "daySlots"
     FROM bookings b
     JOIN complexes c ON c.id = b.complex_id
     LEFT JOIN meal_options mo ON mo.id = b.meal_option_id
     WHERE b.customer_user_id = $1 ORDER BY b.created_at DESC`,
    [request.user!.id],
  );
  response.json({ bookings: result.rows });
});

router.get("/api/manager/complexes", requireRole("admin"), async (_request, response) => {
  const result = await pool.query(
    `SELECT c.id, c.name, c.description, c.region, c.address,
            c.is_published AS "isPublished"
     FROM complexes c ORDER BY c.name`,
  );
  response.json({ complexes: result.rows });
});

router.get("/api/manager/bookings", requireRole("admin"), async (_request, response) => {
  const result = await pool.query(
    `SELECT b.id, b.complex_id AS "complexId", c.name AS "complexName",
            b.booking_type AS "bookingType",
            b.check_in AS "checkIn", b.check_out AS "checkOut",
            b.group_size AS "groupSize", b.group_type AS "groupType",
            b.status, b.admin_note AS "adminNote", b.created_at AS "createdAt",
            b.processed_at AS "processedAt", processor.full_name AS "processedBy",
            u.full_name AS "customerName", u.email AS "customerEmail",
            mo.name AS "mealOption",
            COALESCE((
              SELECT json_agg(to_char(s.start_time, 'HH24:MI') ORDER BY s.start_time)
              FROM booking_day_slots s WHERE s.booking_id = b.id
            ), '[]'::json) AS "daySlots",
            COALESCE((
              SELECT json_agg(json_build_object('name', d.name, 'beds', bd.beds_reserved))
              FROM booking_dormitories bd JOIN dormitories d ON d.id = bd.dormitory_id
              WHERE bd.booking_id = b.id
            ), '[]'::json) AS dormitories,
            COALESCE((
              SELECT json_agg(json_build_object(
                'name', f.name,
                'sports', (
                  SELECT json_agg(s.name ORDER BY s.name)
                  FROM facility_sports fs
                  JOIN sports s ON s.id = fs.sport_id
                  WHERE fs.facility_id = f.id
                )
              ))
              FROM booking_facilities bf
              JOIN facilities f ON f.id = bf.facility_id
              WHERE bf.booking_id = b.id
            ), '[]'::json) AS facilities
     FROM bookings b
     JOIN complexes c ON c.id = b.complex_id
     JOIN users u ON u.id = b.customer_user_id
     LEFT JOIN users processor ON processor.id = b.processed_by_user_id
     LEFT JOIN meal_options mo ON mo.id = b.meal_option_id
     ORDER BY b.created_at DESC`,
  );
  response.json({ bookings: result.rows });
});

router.patch("/api/manager/bookings/:id", requireRole("admin"), async (request, response) => {
  const id = parseId(request.params.id);
  const input = statusSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string; status: string }>(
      `SELECT b.id, b.status
       FROM bookings b WHERE b.id = $1 FOR UPDATE`,
      [id],
    );
    const booking = result.rows[0];
    if (!booking) throw new HttpError(404, "Cette demande de séjour n'a pas été trouvée.");
    if (booking.status !== "pending") {
      throw new HttpError(409, "Seules les demandes en attente peuvent être traitées.");
    }
    await client.query(
      `UPDATE bookings
       SET status = $2, admin_note = $3, processed_by_user_id = $4,
           processed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, input.status, input.adminNote ?? null, request.user!.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.json({ booking: { id, status: input.status } });
});

router.post("/api/admin/complexes", requireRole("admin"), async (request, response) => {
  const input = z.object({
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(5000).default(""),
    region: z.literal("Alpes").default("Alpes"),
    address: z.string().trim().max(300).default(""),
    imageUrl: z.string().url().max(1000).nullable().optional(),
    isPublished: z.boolean().default(false),
  }).parse(request.body);
  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO complexes (name, description, region, address, image_url, is_published)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [input.name, input.description, input.region, input.address, input.imageUrl ?? null, input.isPublished],
    );
    response.status(201).json({ complex: { id: result.rows[0]!.id } });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new HttpError(409, "Un seul lieu de réservation est autorisé sur la plateforme.");
    }
    throw error;
  }
});

router.patch("/api/admin/complexes/:id", requireRole("admin"), async (request, response) => {
  const id = parseId(request.params.id);
  const input = z.object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(5000).optional(),
    region: z.literal("Alpes").optional(),
    address: z.string().trim().max(300).optional(),
    imageUrl: z.string().url().max(1000).nullable().optional(),
    isPublished: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0).parse(request.body);
  if (input.isPublished) {
    const setup = await pool.query<{
      has_facilities: boolean;
      has_dormitories: boolean;
    }>(
      `SELECT
              EXISTS (SELECT 1 FROM facilities f WHERE f.complex_id = c.id AND f.is_active) AS has_facilities,
              EXISTS (SELECT 1 FROM dormitories d WHERE d.complex_id = c.id AND d.is_active) AS has_dormitories
       FROM complexes c WHERE c.id = $1`,
      [id],
    );
    const complex = setup.rows[0];
    if (!complex) throw new HttpError(404, "Ce complexe n'a pas été trouvé.");
    if (!complex.has_facilities || !complex.has_dormitories) {
      throw new HttpError(409, "Avant publication, ajoutez au moins une infrastructure et un dortoir.");
    }
  }
  const result = await pool.query(
    `UPDATE complexes SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       region = COALESCE($4, region),
       address = COALESCE($5, address),
       image_url = COALESCE($6, image_url),
       is_published = COALESCE($7, is_published)
     WHERE id = $1 RETURNING id`,
    [id, input.name ?? null, input.description ?? null, input.region ?? null, input.address ?? null,
      input.imageUrl ?? null, input.isPublished ?? null],
  );
  if (!result.rowCount) throw new HttpError(404, "Ce complexe n'a pas été trouvé.");
  response.json({ complex: { id } });
});

const managerResource = requireRole("admin");
async function assertComplexAccess(complexId: string) {
  const result = await pool.query(
    "SELECT 1 FROM complexes WHERE id = $1",
    [complexId],
  );
  if (!result.rowCount) throw new HttpError(404, "Complexe introuvable ou inaccessible.");
}

router.post("/api/manager/complexes/:complexId/facilities", managerResource, async (request, response) => {
  const complexId = parseId(request.params.complexId);
  await assertComplexAccess(complexId);
  const input = z.object({
    sportIds: z.array(z.string().uuid()).min(1).max(10),
    name: z.string().trim().min(2).max(160),
    facilityType: z.string().trim().min(2).max(80),
    description: z.string().trim().max(2000).default(""),
  }).parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sports = await client.query(
      "SELECT id FROM sports WHERE id = ANY($1::uuid[]) FOR SHARE",
      [input.sportIds],
    );
    if (sports.rowCount !== new Set(input.sportIds).size) {
      throw new HttpError(400, "Un ou plusieurs sports sélectionnés sont inconnus.");
    }
    const result = await client.query<{ id: string }>(
      `INSERT INTO facilities (complex_id, name, facility_type, description)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [complexId, input.name, input.facilityType, input.description],
    );
    for (const sportId of input.sportIds) {
      await client.query(
        "INSERT INTO facility_sports (facility_id, sport_id) VALUES ($1, $2)",
        [result.rows[0]!.id, sportId],
      );
    }
    await client.query("COMMIT");
    response.status(201).json({ facility: { id: result.rows[0]!.id } });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.patch("/api/manager/facilities/:id", managerResource, async (request, response) => {
  const id = parseId(request.params.id);
  const input = z.object({
    sportIds: z.array(z.string().uuid()).min(1).max(10).optional(),
    name: z.string().trim().min(2).max(160).optional(),
    facilityType: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(2000).optional(),
    isActive: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0).parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const facility = await client.query(
      `SELECT f.id FROM facilities f
       WHERE f.id = $1
       FOR UPDATE`,
      [id],
    );
    if (!facility.rowCount) throw new HttpError(404, "Équipement introuvable ou inaccessible.");
    if (input.sportIds) {
      const sports = await client.query(
        "SELECT id FROM sports WHERE id = ANY($1::uuid[]) FOR SHARE",
        [input.sportIds],
      );
      if (sports.rowCount !== new Set(input.sportIds).size) {
        throw new HttpError(400, "Un ou plusieurs sports sélectionnés sont inconnus.");
      }
      await client.query("DELETE FROM facility_sports WHERE facility_id = $1", [id]);
      for (const sportId of input.sportIds) {
        await client.query(
          "INSERT INTO facility_sports (facility_id, sport_id) VALUES ($1, $2)",
          [id, sportId],
        );
      }
    }
    await client.query(
      `UPDATE facilities SET
         name = COALESCE($2, name),
         facility_type = COALESCE($3, facility_type),
         description = COALESCE($4, description),
         is_active = COALESCE($5, is_active)
       WHERE id = $1`,
      [id, input.name ?? null, input.facilityType ?? null, input.description ?? null, input.isActive ?? null],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.json({ facility: { id } });
});

router.post("/api/manager/complexes/:complexId/dormitories", managerResource, async (request, response) => {
  const complexId = parseId(request.params.complexId);
  await assertComplexAccess(complexId);
  const input = z.object({
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).default(""),
    bedCount: z.number().int().min(1).max(500),
  }).parse(request.body);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO dormitories (complex_id, name, description, bed_count)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [complexId, input.name, input.description, input.bedCount],
  );
  response.status(201).json({ dormitory: { id: result.rows[0]!.id } });
});

router.patch("/api/manager/dormitories/:id", managerResource, async (request, response) => {
  const id = parseId(request.params.id);
  const input = z.object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    bedCount: z.number().int().min(1).max(500).optional(),
    isActive: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0).parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const dormitory = await client.query<{ bed_count: number }>(
      `SELECT d.bed_count FROM dormitories d
       WHERE d.id = $1
       FOR UPDATE`,
      [id],
    );
    if (!dormitory.rowCount) throw new HttpError(404, "Dortoir introuvable ou inaccessible.");
    if (input.bedCount !== undefined && input.bedCount !== dormitory.rows[0]!.bed_count) {
      const activeBookings = await client.query(
        `SELECT 1 FROM booking_dormitories bd
         JOIN bookings b ON b.id = bd.booking_id
         WHERE bd.dormitory_id = $1 AND b.status IN ('pending', 'confirmed')
           AND b.check_out > CURRENT_DATE
         LIMIT 1`,
        [id],
      );
      if (activeBookings.rowCount) {
        throw new HttpError(409, "La capacité d'un dortoir ne peut pas changer s'il est déjà réservé.");
      }
    }
    await client.query(
      `UPDATE dormitories SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         bed_count = COALESCE($4, bed_count),
         is_active = COALESCE($5, is_active)
       WHERE id = $1`,
      [id, input.name ?? null, input.description ?? null, input.bedCount ?? null, input.isActive ?? null],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  response.json({ dormitory: { id } });
});

router.post("/api/manager/complexes/:complexId/meals", managerResource, async (request, response) => {
  const complexId = parseId(request.params.complexId);
  await assertComplexAccess(complexId);
  const input = z.object({
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).default(""),
  }).parse(request.body);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO meal_options (complex_id, name, description)
     VALUES ($1, $2, $3) RETURNING id`,
    [complexId, input.name, input.description],
  );
  response.status(201).json({ mealOption: { id: result.rows[0]!.id } });
});

router.patch("/api/manager/meals/:id", managerResource, async (request, response) => {
  const id = parseId(request.params.id);
  const input = z.object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    isActive: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0).parse(request.body);
  const result = await pool.query(
    `UPDATE meal_options m SET
       name = COALESCE($2, m.name),
       description = COALESCE($3, m.description),
       is_active = COALESCE($4, m.is_active)
     WHERE m.id = $1 AND EXISTS (
       SELECT 1 FROM complexes c WHERE c.id = m.complex_id
     )
     RETURNING m.id`,
    [id, input.name ?? null, input.description ?? null, input.isActive ?? null],
  );
  if (!result.rowCount) throw new HttpError(404, "Option repas introuvable ou inaccessible.");
  response.json({ mealOption: { id } });
});

router.get("/api/admin/users", requireRole("admin"), async (_request, response) => {
  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name AS "fullName", u.role
     FROM users u ORDER BY u.created_at DESC`,
  );
  response.json({ users: result.rows });
});

export default router;
