import { pool } from "./db/pool.js";

export async function purgeExpiredCampPrivateData() {
  const result = await pool.query(
    `UPDATE camp_participants AS participant
     SET private_data_encrypted = NULL
     FROM camp_enrollments AS enrollment
     JOIN camp_sessions AS camp_session ON camp_session.id = enrollment.camp_session_id
     WHERE participant.enrollment_id = enrollment.id
       AND camp_session.end_date < (NOW() AT TIME ZONE 'Europe/Paris')::date
       AND participant.private_data_encrypted IS NOT NULL
     RETURNING participant.id`,
  );
  return result.rowCount ?? 0;
}
