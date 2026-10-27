import "../config.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "./pool.js";

const input = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(200),
  fullName: z.string().trim().min(2).max(120),
});

try {
  const parsed = input.safeParse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    fullName: process.env.ADMIN_FULL_NAME,
  });
  if (!parsed.success) {
    throw new Error("Définis ADMIN_EMAIL, ADMIN_PASSWORD (12 caractères minimum) et ADMIN_FULL_NAME.");
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  let result;
  try {
    result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [parsed.data.email, passwordHash, parsed.data.fullName],
    );
  } catch (error) {
    if ((error as { constraint?: string }).constraint === "users_single_admin_idx") {
      throw new Error("Un seul administrateur peut exister. Le compte administrateur est déjà configuré.");
    }
    throw error;
  }
  if (!result.rowCount) {
    const existing = await pool.query<{ role: string }>(
      "SELECT role FROM users WHERE email = $1",
      [parsed.data.email],
    );
    if (existing.rows[0]?.role !== "admin") {
      throw new Error("Cette adresse e-mail appartient déjà à un compte qui n'est pas administrateur.");
    }
  }
  console.info("Compte administrateur créé ou déjà présent.");
} finally {
  await pool.end();
}
