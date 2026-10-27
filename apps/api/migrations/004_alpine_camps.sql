CREATE TABLE camp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL CHECK (season IN ('summer', 'winter')),
  age_group TEXT NOT NULL CHECK (age_group IN ('little', 'middle', 'teen', 'adult')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INTEGER NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 20 CHECK (capacity = 20),
  reserved_places INTEGER NOT NULL DEFAULT 0 CHECK (reserved_places BETWEEN 0 AND capacity),
  registration_open BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date),
  CHECK (end_date - start_date + 1 = duration_days),
  CHECK (
    (age_group = 'little' AND duration_days = 4)
    OR (age_group IN ('middle', 'teen', 'adult') AND duration_days = 7)
  )
);
CREATE INDEX camp_sessions_public_dates_idx
  ON camp_sessions (start_date, age_group, season)
  WHERE registration_open = TRUE;

CREATE TABLE camp_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_session_id UUID NOT NULL REFERENCES camp_sessions(id),
  customer_user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  health_data_consent_at TIMESTAMPTZ NOT NULL,
  health_data_consent_version TEXT NOT NULL,
  admin_note TEXT,
  processed_by_user_id UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX camp_enrollments_customer_idx
  ON camp_enrollments (customer_user_id, created_at DESC);
CREATE INDEX camp_enrollments_session_status_idx
  ON camp_enrollments (camp_session_id, status);

CREATE TABLE camp_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES camp_enrollments(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  recommended_age_group BOOLEAN NOT NULL,
  private_data_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX camp_participants_enrollment_idx ON camp_participants (enrollment_id);

CREATE FUNCTION enforce_camp_capacity() RETURNS TRIGGER AS $$
DECLARE
  session_id UUID;
  enrollment_status TEXT;
BEGIN
  SELECT e.camp_session_id, e.status
  INTO session_id, enrollment_status
  FROM camp_enrollments e
  WHERE e.id = NEW.enrollment_id
  FOR UPDATE;

  IF enrollment_status IN ('pending', 'confirmed') THEN
    UPDATE camp_sessions
    SET reserved_places = reserved_places + 1
    WHERE id = session_id AND reserved_places < capacity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Camp session capacity exceeded'
        USING ERRCODE = '23514', CONSTRAINT = 'camp_session_capacity';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER camp_participants_capacity_guard
  BEFORE INSERT ON camp_participants
  FOR EACH ROW EXECUTE FUNCTION enforce_camp_capacity();

CREATE FUNCTION release_camp_capacity() RETURNS TRIGGER AS $$
DECLARE
  participant_count INTEGER;
BEGIN
  IF OLD.status IN ('pending', 'confirmed') AND NEW.status = 'cancelled' THEN
    SELECT COUNT(*)::INTEGER INTO participant_count
    FROM camp_participants WHERE enrollment_id = OLD.id;

    UPDATE camp_sessions
    SET reserved_places = reserved_places - participant_count
    WHERE id = OLD.camp_session_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER camp_enrollments_capacity_release
  BEFORE UPDATE OF status ON camp_enrollments
  FOR EACH ROW EXECUTE FUNCTION release_camp_capacity();
