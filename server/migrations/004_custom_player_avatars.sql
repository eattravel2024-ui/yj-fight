-- Small, normalized account avatars live with persistent account data and backups.
CREATE TABLE player_avatars (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  image BYTEA NOT NULL CHECK (octet_length(image) BETWEEN 1 AND 131072),
  digest TEXT NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE users DROP CONSTRAINT users_avatar_check;
ALTER TABLE users ADD CONSTRAINT users_avatar_check CHECK (
  avatar IN ('azhi', 'sezi', 'gambler', 'winnie') OR
  avatar ~ '^/api/avatars/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{64}\.webp$'
);
