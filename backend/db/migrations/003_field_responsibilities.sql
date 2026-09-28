-- 003_field_responsibilities.sql
-- Field Officer responsibility model (Pravi clarification, Checkpoint 04.1).
--
-- Government assigns a Field Officer to an infrastructure asset/project in a capacity
-- (CONSTRUCTION or MAINTENANCE). That explicit assignment - and nothing else, in particular
-- neither department membership nor activity assignment - is what gives a FIELD_USER access
-- to the asset. It is deliberately separate from activity_assignments (task-level work).
--
-- Foreign keys are RESTRICT (no cascading deletes), consistent with 001_init_schema.sql.

CREATE TYPE responsibility_type AS ENUM ('CONSTRUCTION', 'MAINTENANCE');

CREATE TABLE asset_responsibilities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            UUID NOT NULL REFERENCES infrastructure_assets(id) ON DELETE RESTRICT,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  responsibility_type responsibility_type NOT NULL,
  assigned_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row per (asset, officer, capacity). The same officer may hold both capacities on an asset.
  -- The unique index also serves "who is responsible for this asset" (leading column asset_id).
  CONSTRAINT uq_asset_responsibility UNIQUE (asset_id, user_id, responsibility_type)
);

-- Serves "which assets is this officer responsible for" (asset list scope + access check).
CREATE INDEX idx_asset_responsibilities_user_asset ON asset_responsibilities (user_id, asset_id);
