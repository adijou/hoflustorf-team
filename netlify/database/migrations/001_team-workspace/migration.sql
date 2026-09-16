-- Small-team workspace. Each command and its audit event commit atomically.
CREATE TABLE team_workspace (
  id text PRIMARY KEY CHECK (id = 'hoflustorf'),
  version bigint NOT NULL DEFAULT 0,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO team_workspace (id, data) VALUES
 ('hoflustorf', '{"members":[],"tasks":[],"entries":[],"completions":[],"reports":[]}');
CREATE TABLE team_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL,
  workspace_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_audit_actor_date ON team_audit(actor_id, created_at);
