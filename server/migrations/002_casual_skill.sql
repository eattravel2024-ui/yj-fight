-- Quick Match has its own hidden skill estimate. It never changes ranked RP.
CREATE TABLE casual_ratings (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
 mmr DOUBLE PRECISION NOT NULL DEFAULT 1000 CHECK (mmr BETWEEN 0 AND 10000),
 rd DOUBLE PRECISION NOT NULL DEFAULT 350 CHECK (rd > 0 AND rd <= 500),
 games INTEGER NOT NULL DEFAULT 0 CHECK (games >= 0),
 last_played_at TIMESTAMPTZ
);
