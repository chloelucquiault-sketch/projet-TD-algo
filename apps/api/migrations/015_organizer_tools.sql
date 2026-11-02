CREATE TABLE contact_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO contact_threads (customer_user_id, created_at, updated_at)
SELECT customer_user_id, MIN(created_at), MAX(created_at)
FROM contact_messages
GROUP BY customer_user_id;

ALTER TABLE contact_messages
  ADD COLUMN thread_id UUID,
  ADD COLUMN sender_role TEXT NOT NULL DEFAULT 'customer'
    CHECK (sender_role IN ('customer', 'admin'));

UPDATE contact_messages AS message
SET thread_id = thread.id
FROM contact_threads AS thread
WHERE thread.customer_user_id = message.customer_user_id;

ALTER TABLE contact_messages
  ALTER COLUMN thread_id SET NOT NULL,
  ADD CONSTRAINT contact_messages_thread_fk
    FOREIGN KEY (thread_id) REFERENCES contact_threads(id);

CREATE INDEX contact_messages_thread_created_idx
  ON contact_messages (thread_id, created_at, id);

ALTER TABLE camp_enrollments
  ADD COLUMN internal_note TEXT
  CHECK (internal_note IS NULL OR length(internal_note) <= 1000);
