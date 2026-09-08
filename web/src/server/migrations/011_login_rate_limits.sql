CREATE TABLE login_rate_limits (
  key_hash TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('account', 'trusted_ip')),
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count BETWEEN 0 AND 5),
  lock_level INTEGER NOT NULL DEFAULT 0 CHECK (lock_level BETWEEN 0 AND 4),
  locked_until TIMESTAMPTZ,
  failure_expires_at TIMESTAMPTZ,
  level_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'account' AND key_hash ~ '^login-limit:account:[A-Za-z0-9_-]{43}$') OR
    (scope = 'trusted_ip' AND key_hash ~ '^login-limit:ip:[A-Za-z0-9_-]{43}$')
  ),
  CHECK (failure_count = 0 OR failure_expires_at IS NOT NULL),
  CHECK (lock_level = 0 OR level_expires_at IS NOT NULL),
  CHECK (locked_until IS NULL OR (
    lock_level > 0 AND failure_count = 0 AND failure_expires_at IS NULL AND
    locked_until <= updated_at + INTERVAL '300 seconds'
  ))
);

-- Supabase Data API clients must not inspect or edit limiter state.
-- The backend connects through its existing privileged PostgreSQL role.
ALTER TABLE login_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON login_rate_limits FROM PUBLIC;
