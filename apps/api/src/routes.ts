import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "./db/pool.js";
import { HttpError } from "./errors.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { bookingSchema, registerSchema, stayDatesSchema } from "./validation.js";

const router = Router();
const idSchema = z.string().uuid();
const statusSchema = z.object({
  status: z.enum(["confirmed", "cancelled"]),
  managerNote: z.string().trim().max(1000).optional(),
});

const parseId = (value: unknown) => idSchema.parse(value);

router.get("/health", async (_request, response) => {
  await pool.query("SELECT 1");
  response.json({ status: "ok" });
});

router.get("/api/auth/me", (request, response) => {
  response.json({ user: request.user ?? null });
});

router.post("/api/auth/register", async (request, response) => {
  const input = registerSchema.parse(request.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, organization_name, role)
       VALUES ($1, $2, $3, $4, 'customer')
       RETURNING id`,
      [input.email, passwordHash, input.fullName, input.organizationName ?? null],
    );
    await new Promise<void>((resolve, reject) => {
      request.session.regenerate((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    request.session.userId = result.rows[0]!.id;
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
  const input = z.object({
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(200),
  }).parse(request.body);
  const result = await pool.query<{
    id: string;
    email: string;
    full_name: string;
    role: "customer" | "manager" | "admin";
    password_hash: string;
  }>(
    "SELECT id, email, full_name, role, password_hash FROM users WHERE email = $1",
    [input.email],
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw new HttpError(401, "Adresse e-mail ou mot de passe incorrect.");
  }
  await new Promise<void>((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  request.session.userId = user.id;
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
      SELECT 1 FROM facilities f JOIN sports s ON s.id = f.sport_id
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
              s.id AS "sportId", s.name AS "sportName", s.slug AS "sportSlug"
       FROM facilities f JOIN sports s ON s.id = f.sport_id
       WHERE f.complex_id = $1 AND f.is_active = TRUE ORDER BY s.name, f.name`,
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
       (complex_id, customer_user_id, check_in, check_out, group_size, group_type, meal_option_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
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
    `SELECT b.id, b.check_in AS "checkIn", b.check_out AS "checkOut",
            b.group_size AS "groupSize", b.group_type AS "groupType",
            b.status, b.created_at AS "createdAt", c.name AS "complexName",
            mo.name AS "mealOption"
     FROM bookings b
     JOIN complexes c ON c.id = b.complex_id
     LEFT JOIN meal_options mo ON mo.id = b.meal_option_id
     WHERE b.customer_user_id = $1 ORDER BY b.created_at DESC`,
    [request.user!.id],
  );
  response.json({ bookings: result.rows });
});

router.get("/api/manager/complexes", requireRole("manager", "admin"), async (request, response) => {
  const result = await pool.query(
    `SELECT c.id, c.name, c.description, c.region, c.address,
            c.is_published AS "isPublished", u.email AS "managerEmail"
     FROM complexes c
     LEFT JOIN users u ON u.id = c.manager_user_id
     WHERE ($1::text = 'admin' OR c.manager_user_id = $2)
     ORDER BY c.name`,
    [request.user!.role, request.user!.id],
  );
  response.json({ complexes: result.rows });
});

router.get("/api/manager/bookings", requireRole("manager", "admin"), async (request, response) => {
  const result = await pool.query(
    `SELECT b.id, b.complex_id AS "complexId", c.name AS "complexName",
            b.check_in AS "checkIn", b.check_out AS "checkOut",
            b.group_size AS "groupSize", b.group_type AS "groupType",
            b.status, b.manager_note AS "managerNote", b.created_at AS "createdAt",
            u.full_name AS "customerName", u.email AS "customerEmail",
            mo.name AS "mealOption",
            COALESCE((
              SELECT json_agg(json_build_object('name', d.name, 'beds', bd.beds_reserved))
              FROM booking_dormitories bd JOIN dormitories d ON d.id = bd.dormitory_id
              WHERE bd.booking_id = b.id
            ), '[]'::json) AS dormitories,
            COALESCE((
              SELECT json_agg(json_build_object('name', f.name, 'sport', s.name))
              FROM booking_facilities bf
              JOIN facilities f ON f.id = bf.facility_id
              JOIN sports s ON s.id = f.sport_id
              WHERE bf.booking_id = b.id
            ), '[]'::json) AS facilities
     FROM bookings b
     JOIN complexes c ON c.id = b.complex_id
     JOIN users u ON u.id = b.customer_user_id
     LEFT JOIN meal_options mo ON mo.id = b.meal_option_id
     WHERE ($1::text = 'admin' OR c.manager_user_id = $2)
     ORDER BY b.created_at DESC`,
    [request.user!.role, request.user!.id],
  );
  response.json({ bookings: result.rows });
});

router.patch("/api/manager/bookings/:id", requireRole("manager", "admin"), async (request, response) => {
  const id = parseId(request.params.id);
  const input = statusSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      status: string;
      complex_id: string;
      manager_user_id: string | null;
    }>(
      `SELECT b.id, b.status, b.complex_id, c.manager_user_id
       FROM bookings b JOIN complexes c ON c.id = b.complex_id
       WHERE b.id = $1 FOR UPDATE OF c, b`,
      [id],
    );
    const booking = result.rows[0];
    if (!booking) throw new HttpError(404, "Cette demande de séjour n'a pas été trouvée.");
    if (request.user!.role === "manager" && booking.manager_user_id !== request.user!.id) {
      throw new HttpError(403, "Tu ne peux gérer que les demandes de ton complexe.");
    }
    if (booking.status !== "pending") {
      throw new HttpError(409, "Seules les demandes en attente peuvent être traitées.");
    }
    await client.query(
      `UPDATE bookings
       SET status = $2, manager_note = $3, updated_at = NOW()
       WHERE id = $1`,
      [id, input.status, input.managerNote ?? null],
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
    region: z.string().trim().min(2).max(100),
    address: z.string().trim().max(300).default(""),
    imageUrl: z.string().url().max(1000).nullable().optional(),
    isPublished: z.boolean().default(false),
  }).parse(request.body);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO complexes (name, description, region, address, image_url, is_published)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.name, input.description, input.region, input.address, input.imageUrl ?? null, input.isPublished],
  );
  response.status(201).json({ complex: { id: result.rows[0]!.id } });
});

router.patch("/api/admin/complexes/:id", requireRole("admin"), async (request, response) => {
  const id = parseId(request.params.id);
  const input = z.object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(5000).optional(),
    region: z.string().trim().min(2).max(100).optional(),
    address: z.string().trim().max(300).optional(),
    imageUrl: z.string().url().max(1000).nullable().optional(),
    isPublished: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0).parse(request.body);
  if (input.isPublished) {
    const setup = await pool.query<{
      manager_user_id: string | null;
      has_facilities: boolean;
      has_dormitories: boolean;
    }>(
      `SELECT c.manager_user_id,
              EXISTS (SELECT 1 FROM facilities f WHERE f.complex_id = c.id AND f.is_active) AS has_facilities,
              EXISTS (SELECT 1 FROM dormitories d WHERE d.complex_id = c.id AND d.is_active) AS has_dormitories
       FROM complexes c WHERE c.id = $1`,
      [id],
    );
    const complex = setup.rows[0];
    if (!complex) throw new HttpError(404, "Ce complexe n'a pas été trouvé.");
    if (!complex.manager_user_id || !complex.has_facilities || !complex.has_dormitories) {
      throw new HttpError(409, "Avant publication, assignez un gestionnaire et ajoutez au moins une infrastructure et un dortoir.");
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

router.post("/api/admin/managers", requireRole("admin"), async (request, response) => {
  const input = z.object({
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password: z.string().min(12).max(200),
    fullName: z.string().trim().min(2).max(120),
    complexId: z.string().uuid(),
  }).parse(request.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const complex = await client.query<{ manager_user_id: string | null }>(
      "SELECT manager_user_id FROM complexes WHERE id = $1 FOR UPDATE",
      [input.complexId],
    );
    if (!complex.rowCount) throw new HttpError(404, "Ce complexe n'a pas été trouvé.");
    if (complex.rows[0]!.manager_user_id) {
      throw new HttpError(409, "Ce complexe a déjà un gestionnaire assigné.");
    }
    const manager = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'manager') RETURNING id`,
      [input.email, passwordHash, input.fullName],
    );
    await client.query(
      "UPDATE complexes SET manager_user_id = $2 WHERE id = $1",
      [input.complexId, manager.rows[0]!.id],
    );
    await client.query("COMMIT");
    response.status(201).json({ manager: { id: manager.rows[0]!.id, email: input.email } });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") {
      throw new HttpError(409, "Un compte existe déjà avec cette adresse e-mail.");
    }
    throw error;
  } finally {
    client.release();
  }
});

const managerResource = requireRole("manager", "admin");
async function assertComplexAccess(complexId: string, userId: string, role: string) {
  const result = await pool.query(
    `SELECT 1 FROM complexes
     WHERE id = $1 AND ($2::text = 'admin' OR manager_user_id = $3)`,
    [complexId, role, userId],
  );
  if (!result.rowCount) throw new HttpError(404, "Complexe introuvable ou inaccessible.");
}

router.post("/api/manager/complexes/:complexId/facilities", managerResource, async (request, response) => {
  const complexId = parseId(request.params.complexId);
  await assertComplexAccess(complexId, request.user!.id, request.user!.role);
  const input = z.object({
    sportId: z.string().uuid(),
    name: z.string().trim().min(2).max(160),
    facilityType: z.string().trim().min(2).max(80),
    description: z.string().trim().max(2000).default(""),
  }).parse(request.body);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO facilities (complex_id, sport_id, name, facility_type, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [complexId, input.sportId, input.name, input.facilityType, input.description],
  );
  response.status(201).json({ facility: { id: result.rows[0]!.id } });
});

router.patch("/api/manager/facilities/:id", managerResource, async (request, response) => {
  const id = parseId(request.params.id);
  const input = z.object({
    sportId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(160).optional(),
    facilityType: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(2000).optional(),
    isActive: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0).parse(request.body);
  const result = await pool.query(
    `UPDATE facilities f SET
       sport_id = COALESCE($2, f.sport_id),
       name = COALESCE($3, f.name),
       facility_type = COALESCE($4, f.facility_type),
       description = COALESCE($5, f.description),
       is_active = COALESCE($6, f.is_active)
     WHERE f.id = $1 AND EXISTS (
       SELECT 1 FROM complexes c WHERE c.id = f.complex_id
         AND ($7::text = 'admin' OR c.manager_user_id = $8)
     )
     RETURNING f.id`,
    [id, input.sportId ?? null, input.name ?? null, input.facilityType ?? null, input.description ?? null,
      input.isActive ?? null, request.user!.role, request.user!.id],
  );
  if (!result.rowCount) throw new HttpError(404, "Équipement introuvable ou inaccessible.");
  response.json({ facility: { id } });
});

router.post("/api/manager/complexes/:complexId/dormitories", managerResource, async (request, response) => {
  const complexId = parseId(request.params.complexId);
  await assertComplexAccess(complexId, request.user!.id, request.user!.role);
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
       JOIN complexes c ON c.id = d.complex_id
       WHERE d.id = $1 AND ($2::text = 'admin' OR c.manager_user_id = $3)
       FOR UPDATE OF c, d`,
      [id, request.user!.role, request.user!.id],
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
  await assertComplexAccess(complexId, request.user!.id, request.user!.role);
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
         AND ($5::text = 'admin' OR c.manager_user_id = $6)
     )
     RETURNING m.id`,
    [id, input.name ?? null, input.description ?? null, input.isActive ?? null,
      request.user!.role, request.user!.id],
  );
  if (!result.rowCount) throw new HttpError(404, "Option repas introuvable ou inaccessible.");
  response.json({ mealOption: { id } });
});

router.get("/api/admin/users", requireRole("admin"), async (_request, response) => {
  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name AS "fullName", u.role, c.name AS "complexName"
     FROM users u LEFT JOIN complexes c ON c.manager_user_id = u.id
     ORDER BY u.created_at DESC`,
  );
  response.json({ users: result.rows });
});

export default router;
