CREATE TABLE admin_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id INTEGER NOT NULL REFERENCES admin_users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_logs_actor_created_at_idx
  ON admin_audit_logs (actor_id, created_at DESC);
CREATE INDEX admin_audit_logs_resource_created_at_idx
  ON admin_audit_logs (resource_type, resource_id, created_at DESC);

CREATE FUNCTION prevent_admin_audit_log_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin audit logs are append-only';
END;
$$;

CREATE TRIGGER admin_audit_logs_no_update
  BEFORE UPDATE ON admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_log_mutation();
CREATE TRIGGER admin_audit_logs_no_delete
  BEFORE DELETE ON admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_log_mutation();
