ALTER TABLE camp_enrollments
  ADD COLUMN cancellation_reason TEXT
  CHECK (
    cancellation_reason IS NULL
    OR length(btrim(cancellation_reason)) BETWEEN 1 AND 1000
  );
