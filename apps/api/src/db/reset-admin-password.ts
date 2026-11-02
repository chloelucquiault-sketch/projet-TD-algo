import "../config.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "./pool.js";

const input = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(200),
});

try {
  const parsed = input.safeParse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error("Définis ADMIN_EMAIL et ADMIN_PASSWORD (12 caractères minimum).");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const result = await pool.query(
    "UPDATE users SET password_hash = $2 WHERE email = $1 AND role = 'admin' RETURNING id",
    [parsed.data.email, passwordHash],
  );
  if (!result.rowCount) {
    throw new Error("Aucun compte administrateur ne correspond à cette adresse e-mail.");
  }
  console.info("Mot de passe administrateur réinitialisé.");
} finally {
  await pool.end();
}
