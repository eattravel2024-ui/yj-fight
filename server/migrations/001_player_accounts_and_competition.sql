-- Stable identities and server-owned competitive records. Application code
-- supplies UUIDs and opaque tokens; this schema needs no privileged extension.
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted')),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 16 AND display_name = btrim(display_name)),
  avatar TEXT NOT NULL DEFAULT 'azhi' CHECK (avatar IN ('azhi', 'sezi', 'gambler', 'winnie')),
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(preferences) = 'object' AND octet_length(preferences::text) <= 8192),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  last_login_at TIMESTAMPTZ,
  CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  CHECK (password_hash IS NULL OR char_length(password_hash) >= 20)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY CHECK (char_length(token_hash) BETWEEN 32 AND 128),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_hash TEXT NOT NULL CHECK (char_length(csrf_hash) BETWEEN 32 AND 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE auth_tokens (
  token_hash TEXT PRIMARY KEY CHECK (char_length(token_hash) BETWEEN 32 AND 128),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('verify_email', 'reset_password')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);
CREATE INDEX auth_tokens_user_kind_idx ON auth_tokens(user_id, kind);
CREATE INDEX auth_tokens_expiry_idx ON auth_tokens(expires_at) WHERE consumed_at IS NULL;

CREATE TABLE auth_rate_limits (
  key TEXT PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 256),
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX auth_rate_limits_cleanup_idx ON auth_rate_limits(last_attempt_at);

CREATE TABLE oauth_identities (
  provider TEXT NOT NULL CHECK (provider = 'google'),
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 255),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_at_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (provider, subject),
  UNIQUE (provider, user_id)
);

-- Optional durable delivery foundation: no plaintext verification/reset token
-- or mail body is accepted here. Encrypted payloads require an application-held
-- key independent from PostgreSQL. Current routes deliver mail immediately.
CREATE TABLE mail_outbox (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('verify_email', 'reset_password')),
  payload_ciphertext TEXT NOT NULL CHECK (char_length(payload_ciphertext) >= 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  CHECK (expires_at > created_at)
);
CREATE INDEX mail_outbox_pending_idx ON mail_outbox(next_attempt_at) WHERE sent_at IS NULL;

CREATE TABLE seasons (
  id TEXT PRIMARY KEY CHECK (char_length(id) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (status <> 'active' OR (starts_at IS NOT NULL AND ends_at IS NOT NULL))
);
CREATE UNIQUE INDEX seasons_one_active_idx ON seasons(status) WHERE status = 'active';

CREATE TABLE ranked_ratings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  mmr DOUBLE PRECISION NOT NULL DEFAULT 1000 CHECK (mmr BETWEEN 0 AND 10000),
  rd DOUBLE PRECISION NOT NULL DEFAULT 350 CHECK (rd > 0 AND rd <= 500),
  rp INTEGER NOT NULL DEFAULT 0 CHECK (rp BETWEEN 0 AND 1000000),
  placement_games INTEGER NOT NULL DEFAULT 0 CHECK (placement_games BETWEEN 0 AND 5),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  draws INTEGER NOT NULL DEFAULT 0 CHECK (draws >= 0),
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= streak),
  peak_rp INTEGER NOT NULL DEFAULT 0 CHECK (peak_rp >= rp AND peak_rp <= 1000000),
  last_played_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, season_id)
);
CREATE INDEX ranked_ratings_leaderboard_idx ON ranked_ratings(season_id, rp DESC, wins DESC, user_id) WHERE placement_games = 5;

CREATE TABLE matches (
  id TEXT PRIMARY KEY CHECK (char_length(id) BETWEEN 1 AND 128),
  mode TEXT NOT NULL CHECK (mode IN ('custom', 'quick', 'ranked')),
  stage TEXT NOT NULL CHECK (char_length(stage) BETWEEN 1 AND 64),
  season_id TEXT REFERENCES seasons(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'running', 'completed', 'invalid')),
  seed BIGINT,
  winner_slot SMALLINT CHECK (winner_slot BETWEEN 0 AND 3),
  winner_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT,
  rounds JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rounds) = 'array'),
  result JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result) = 'object'),
  invalid_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  CHECK (mode <> 'ranked' OR season_id IS NOT NULL),
  CHECK (status NOT IN ('completed', 'invalid') OR ended_at IS NOT NULL),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX matches_history_idx ON matches(ended_at DESC, id) WHERE status = 'completed';
CREATE INDEX matches_season_history_idx ON matches(season_id, mode, ended_at DESC) WHERE status = 'completed';
CREATE INDEX matches_unfinished_idx ON matches(created_at) WHERE status IN ('preparing', 'running');

CREATE TABLE match_participants (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  slot SMALLINT NOT NULL CHECK (slot BETWEEN 0 AND 3),
  character_id TEXT NOT NULL CHECK (character_id IN ('azhi', 'sezi', 'gambler', 'winnie')),
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'win', 'loss', 'draw', 'invalid')),
  rp_before INTEGER CHECK (rp_before >= 0),
  rp_after INTEGER CHECK (rp_after >= 0),
  mmr_before DOUBLE PRECISION,
  mmr_after DOUBLE PRECISION,
  PRIMARY KEY (match_id, slot),
  UNIQUE (match_id, user_id)
);
CREATE INDEX match_participants_user_history_idx ON match_participants(user_id, match_id);
CREATE INDEX match_participants_user_character_idx ON match_participants(user_id, character_id, outcome);

-- One account can reserve at most one official match at a time, including a
-- preparing match. The composite FK excludes reservations for nonparticipants.
CREATE TABLE active_match_users (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  match_id TEXT NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (match_id, user_id) REFERENCES match_participants(match_id, user_id) ON DELETE RESTRICT
);
CREATE INDEX active_match_users_match_idx ON active_match_users(match_id);

CREATE TABLE matchmaking_queue (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('quick', 'ranked')),
  season_id TEXT REFERENCES seasons(id) ON DELETE RESTRICT,
  character_id TEXT NOT NULL CHECK (character_id IN ('azhi', 'sezi', 'gambler', 'winnie')),
  stage TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'auto' CHECK (char_length(region) BETWEEN 1 AND 32),
  latency_ms INTEGER NOT NULL CHECK (latency_ms BETWEEN 0 AND 2000),
  mmr DOUBLE PRECISION NOT NULL DEFAULT 1000 CHECK (mmr BETWEEN 0 AND 10000),
  state TEXT NOT NULL DEFAULT 'searching' CHECK (state IN ('searching', 'matched')),
  match_id TEXT REFERENCES matches(id) ON DELETE RESTRICT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > joined_at),
  CHECK (mode <> 'ranked' OR season_id IS NOT NULL),
  CHECK (state <> 'matched' OR match_id IS NOT NULL)
);
CREATE INDEX matchmaking_queue_search_idx ON matchmaking_queue(mode, region, joined_at) WHERE state = 'searching';
CREATE INDEX matchmaking_queue_expiry_idx ON matchmaking_queue(expires_at);

CREATE TABLE player_achievements (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  achievement_key TEXT NOT NULL CHECK (char_length(achievement_key) BETWEEN 1 AND 80),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  PRIMARY KEY (user_id, achievement_key)
);

-- Never guess a production launch date. The operator explicitly activates a
-- dated season using the season administration CLI after configuration.
INSERT INTO seasons (id, name, status) VALUES ('season-01', 'Season 01', 'draft');
