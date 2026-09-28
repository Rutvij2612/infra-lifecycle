-- 001_init_schema.sql
-- Core schema for the Infrastructure Lifecycle Platform.
-- Design notes:
--   * The CURRENT lifecycle status lives on infrastructure_assets.
--   * The full HISTORY lives in lifecycle_events (never duplicates the asset row).
--   * Foreign keys are RESTRICT (no cascading deletes) so history/audit data
--     cannot be wiped by deleting a parent. Deactivate users instead of deleting.
--     The only cascade is activity_assignments -> activities (a pure link table).

-- ---------------------------------------------------------------- enums
CREATE TYPE user_role AS ENUM ('ADMIN', 'GOVERNMENT_OFFICER', 'FIELD_USER');

CREATE TYPE asset_type AS ENUM (
  'HOSPITAL', 'HIGHWAY', 'RAILWAY', 'PUBLIC_BUILDING', 'BRIDGE', 'OTHER'
);

CREATE TYPE lifecycle_status AS ENUM (
  'PLANNED', 'UNDER_CONSTRUCTION', 'OPERATIONAL', 'UNDER_MAINTENANCE',
  'REHABILITATION', 'END_OF_LIFE', 'DECOMMISSIONED'
);

CREATE TYPE lifecycle_event_type AS ENUM (
  'PLANNED', 'CONSTRUCTION_STARTED', 'CONSTRUCTION_PROGRESS', 'CONSTRUCTION_COMPLETED',
  'INSPECTION', 'MAINTENANCE_STARTED', 'MAINTENANCE_COMPLETED', 'REHABILITATION',
  'END_OF_LIFE_ASSESSMENT', 'DECOMMISSIONED', 'OTHER'
);

CREATE TYPE activity_type AS ENUM (
  'CONSTRUCTION', 'INSPECTION', 'MAINTENANCE', 'REPAIR', 'REHABILITATION', 'OTHER'
);
CREATE TYPE activity_status AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED');
CREATE TYPE activity_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE inspection_type AS ENUM ('ROUTINE', 'STRUCTURAL', 'SAFETY', 'OTHER');
CREATE TYPE condition_status AS ENUM ('GOOD', 'FAIR', 'POOR', 'CRITICAL');

CREATE TYPE maintenance_type AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'OTHER');
CREATE TYPE maintenance_status AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');

-- ------------------------------------------------- updated_at trigger fn
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------- departments
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- users
-- Data model only; no passwords/auth yet.
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role          user_role NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_role ON users(role);

-- ------------------------------------------------ infrastructure_assets
CREATE TABLE infrastructure_assets (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code                TEXT NOT NULL UNIQUE,
  name                      TEXT NOT NULL,
  asset_type                asset_type NOT NULL,
  description               TEXT,
  department_id             UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  location                  TEXT,
  latitude                  NUMERIC(9,6) CHECK (latitude  BETWEEN -90  AND 90),
  longitude                 NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
  lifecycle_status          lifecycle_status NOT NULL DEFAULT 'PLANNED',
  construction_start_date   DATE,
  completion_date           DATE,
  expected_end_of_life_date DATE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_asset_dates
    CHECK (completion_date IS NULL OR construction_start_date IS NULL
           OR completion_date >= construction_start_date)
);
CREATE INDEX idx_assets_department_id ON infrastructure_assets(department_id);
CREATE INDEX idx_assets_lifecycle_status ON infrastructure_assets(lifecycle_status);
CREATE INDEX idx_assets_asset_type ON infrastructure_assets(asset_type);

-- ------------------------------------------------------ lifecycle_events
CREATE TABLE lifecycle_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            UUID NOT NULL REFERENCES infrastructure_assets(id) ON DELETE RESTRICT,
  event_type          lifecycle_event_type NOT NULL,
  event_date          DATE NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  progress_percentage INTEGER CHECK (progress_percentage BETWEEN 0 AND 100),
  recorded_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Serves the asset timeline query: WHERE asset_id = $1 ORDER BY event_date DESC
CREATE INDEX idx_lifecycle_events_asset_date ON lifecycle_events(asset_id, event_date DESC);
CREATE INDEX idx_lifecycle_events_event_date ON lifecycle_events(event_date);

-- ------------------------------------------------------------ activities
CREATE TABLE activities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            UUID NOT NULL REFERENCES infrastructure_assets(id) ON DELETE RESTRICT,
  title               TEXT NOT NULL,
  description         TEXT,
  activity_type       activity_type NOT NULL,
  status              activity_status NOT NULL DEFAULT 'TODO',
  priority            activity_priority NOT NULL DEFAULT 'MEDIUM',
  start_date          DATE,
  due_date            DATE,
  completed_at        TIMESTAMPTZ,
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  created_by          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_activity_dates
    CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date)
);
CREATE INDEX idx_activities_asset_id ON activities(asset_id);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_due_date ON activities(due_date);

-- ---------------------------------------------------- activity_assignments
CREATE TABLE activity_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT uq_activity_user UNIQUE (activity_id, user_id)
);
-- "My activities" lookup for field users (activity_id is covered by the unique constraint)
CREATE INDEX idx_assignments_user_id ON activity_assignments(user_id);

-- ----------------------------------------------------------- inspections
CREATE TABLE inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES infrastructure_assets(id) ON DELETE RESTRICT,
  inspection_date DATE NOT NULL,
  inspection_type inspection_type NOT NULL,
  condition_status condition_status NOT NULL,
  findings        TEXT,
  recommendations TEXT,
  conducted_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inspections_asset_date ON inspections(asset_id, inspection_date DESC);
CREATE INDEX idx_inspections_conducted_by ON inspections(conducted_by);

-- ---------------------------------------------------- maintenance_records
CREATE TABLE maintenance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES infrastructure_assets(id) ON DELETE RESTRICT,
  maintenance_type maintenance_type NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  start_date      DATE,
  completion_date DATE,
  cost            NUMERIC(14,2) CHECK (cost IS NULL OR cost >= 0),
  status          maintenance_status NOT NULL DEFAULT 'PLANNED',
  performed_by    UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_maintenance_dates
    CHECK (start_date IS NULL OR completion_date IS NULL OR completion_date >= start_date)
);
CREATE INDEX idx_maintenance_asset_id ON maintenance_records(asset_id);
CREATE INDEX idx_maintenance_status ON maintenance_records(status);
CREATE INDEX idx_maintenance_performed_by ON maintenance_records(performed_by);

-- ------------------------------------------------- updated_at triggers
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON infrastructure_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_activities_updated_at BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
