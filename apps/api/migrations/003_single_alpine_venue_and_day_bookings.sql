DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.complexes) > 1 THEN
    RAISE EXCEPTION 'Migration 003 requires choosing one existing Alpine venue before migrating; no complexes were deleted.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.complexes WHERE region NOT ILIKE '%alp%') THEN
    RAISE EXCEPTION 'Migration 003 requires reviewing the existing venue region; it must be in the Alps.';
  END IF;
  IF (SELECT COUNT(*) FROM public.users WHERE role = 'admin') > 1 THEN
    RAISE EXCEPTION 'Migration 003 requires choosing one administrator before migrating; no users were deleted.';
  END IF;
END $$;

UPDATE users SET role = 'customer' WHERE role = 'manager';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'admin'));
CREATE UNIQUE INDEX users_single_admin_idx ON users (role) WHERE role = 'admin';

ALTER TABLE complexes DROP CONSTRAINT IF EXISTS complexes_manager_user_id_fkey;
ALTER TABLE complexes DROP COLUMN IF EXISTS manager_user_id;
DROP INDEX IF EXISTS complexes_manager_idx;
CREATE UNIQUE INDEX complexes_single_location_idx ON complexes ((TRUE));
ALTER TABLE complexes
  ADD CONSTRAINT complexes_alpine_region_check CHECK (region ILIKE '%alp%');

ALTER TABLE bookings
  ADD COLUMN booking_type TEXT NOT NULL DEFAULT 'stay';
ALTER TABLE bookings
  ADD COLUMN processed_by_user_id UUID REFERENCES users(id),
  ADD COLUMN processed_at TIMESTAMPTZ;
ALTER TABLE bookings RENAME COLUMN manager_note TO admin_note;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_type_check;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_booking_type_check CHECK (booking_type IN ('stay', 'day'));

DO $$
DECLARE
  check_constraint RECORD;
BEGIN
  FOR check_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%check_out%'
  LOOP
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT %I', check_constraint.conname);
  END LOOP;
END $$;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_dates_by_type_check CHECK (
    (booking_type = 'stay' AND check_out > check_in AND check_out - check_in >= 2)
    OR (booking_type = 'day' AND check_out = check_in + 1)
  );

CREATE TABLE booking_day_slots (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  PRIMARY KEY (booking_id, facility_id, slot_date, start_time),
  CHECK (start_time >= TIME '08:00'),
  CHECK (end_time <= TIME '20:00'),
  CHECK (end_time - start_time = INTERVAL '3 hours'),
  CHECK (EXTRACT(MINUTE FROM start_time)::INTEGER IN (0, 30)),
  CHECK (EXTRACT(SECOND FROM start_time) = 0)
);

CREATE INDEX booking_day_slots_facility_date_idx
  ON booking_day_slots (facility_id, slot_date, start_time, end_time);
