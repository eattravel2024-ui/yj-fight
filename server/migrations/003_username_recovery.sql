-- Additive conversion: keep user UUIDs, sessions, match history and ratings.
-- Retired email/provider tables are retained for audit/rollback, never used for
-- new registration or email verification. Existing password users can use their
-- previous login identifier once, then read their generated username in profile.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN username TEXT;
UPDATE users SET username=replace(id::text,'-','');
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE(username);
ALTER TABLE users ADD CONSTRAINT users_username_format CHECK(username ~ '^[a-z0-9_]{3,32}$');
ALTER TABLE users ADD COLUMN recovery_code_hash TEXT CHECK(recovery_code_hash IS NULL OR recovery_code_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE users ADD COLUMN recovery_issued_at TIMESTAMPTZ;
UPDATE auth_tokens SET consumed_at=now() WHERE consumed_at IS NULL;
