-- Publish existing proposals as part of deployment, without waiting for a login.
-- A single DO statement keeps the workspace update and audit event atomic.
DO $migration$
DECLARE
  workspace_data jsonb;
  workspace_version bigint;
  task jsonb;
  shared_tasks jsonb := '[]'::jsonb;
  changed_ids jsonb := '[]'::jsonb;
BEGIN
  -- Use the same row lock as the API to preserve concurrent hours and edits.
  SELECT data, version INTO workspace_data, workspace_version
  FROM team_workspace WHERE id = 'hoflustorf' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team workspace is not initialized';
  END IF;

  FOR task IN SELECT value FROM jsonb_array_elements(workspace_data->'tasks')
  LOOP
    IF task->>'assignee' IS DISTINCT FROM ''
       OR task->>'status' IS DISTINCT FROM 'active' THEN
      changed_ids := changed_ids || jsonb_build_array(task->>'id');
      task := task || jsonb_build_object(
        'assignee', '',
        'status', 'active',
        'version', COALESCE((task->>'version')::integer, 1) + 1
      );
    END IF;
    shared_tasks := shared_tasks || jsonb_build_array(task);
  END LOOP;

  -- Already migrated work is a no-op, including its version and audit history.
  IF jsonb_array_length(changed_ids) > 0 THEN
    UPDATE team_workspace
    SET data = jsonb_set(workspace_data, '{tasks}', shared_tasks),
        version = version + 1,
        updated_at = now()
    WHERE id = 'hoflustorf'
    RETURNING version INTO workspace_version;

    INSERT INTO team_audit(actor_id, action, payload, workspace_version)
    VALUES (
      'system:deploy',
      'task.shared-migration',
      jsonb_build_object('taskIds', changed_ids, 'source', '002_shared-work'),
      workspace_version
    );
  END IF;
END
$migration$;
