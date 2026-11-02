CREATE TABLE demo_session_secrets (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  signing_secret TEXT NOT NULL CHECK (length(signing_secret) >= 32)
);
