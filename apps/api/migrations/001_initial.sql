CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  organization_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer', 'manager', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE complexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX complexes_manager_idx ON complexes(manager_user_id);
CREATE INDEX complexes_region_idx ON complexes(region);

CREATE TABLE sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES sports(id),
  name TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX facilities_complex_idx ON facilities(complex_id);

CREATE TABLE dormitories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  bed_count INTEGER NOT NULL CHECK (bed_count > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX dormitories_complex_idx ON dormitories(complex_id);

CREATE TABLE meal_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID NOT NULL REFERENCES complexes(id),
  customer_user_id UUID NOT NULL REFERENCES users(id),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  group_size INTEGER NOT NULL CHECK (group_size > 0),
  group_type TEXT NOT NULL,
  meal_option_id UUID REFERENCES meal_options(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  manager_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (check_out > check_in),
  CHECK (check_out - check_in >= 2)
);
CREATE INDEX bookings_complex_dates_idx ON bookings(complex_id, check_in, check_out)
  WHERE status IN ('pending', 'confirmed');
CREATE INDEX bookings_customer_idx ON bookings(customer_user_id, created_at DESC);

CREATE TABLE booking_facilities (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  PRIMARY KEY (booking_id, facility_id)
);
CREATE INDEX booking_facilities_resource_idx ON booking_facilities(facility_id, booking_id);

CREATE TABLE booking_dormitories (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  dormitory_id UUID NOT NULL REFERENCES dormitories(id),
  beds_reserved INTEGER NOT NULL CHECK (beds_reserved > 0),
  PRIMARY KEY (booking_id, dormitory_id)
);
CREATE INDEX booking_dormitories_resource_idx ON booking_dormitories(dormitory_id, booking_id);

CREATE TABLE session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IDX_session_expire ON session(expire);

INSERT INTO sports (name, slug) VALUES
  ('Football', 'football'),
  ('Rugby', 'rugby'),
  ('Ultimate frisbee', 'ultimate-frisbee'),
  ('Athlétisme', 'athletisme'),
  ('Musculation', 'musculation'),
  ('Natation', 'natation');
