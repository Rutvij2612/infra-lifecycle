-- 002_demo_users.sql  (DEVELOPMENT / DEMO ONLY)
-- One demo account per role, a second field officer (same department, different asset) and an
-- inactive account for testing.
-- Passwords are NOT set here: src/scripts/seed.ts hashes DEV_PASSWORD with bcrypt
-- and applies it to every seeded user (see README "Demo accounts").

INSERT INTO users (name, email, role, department_id, is_active)
SELECT v.name, v.email, v.role::user_role, d.id, v.is_active
FROM (VALUES
  ('Demo Admin',    'admin@demo.local',    'ADMIN',              'GAD', TRUE),
  ('Demo Officer',  'officer@demo.local',  'GOVERNMENT_OFFICER', 'HFW', TRUE),
  ('Demo Field',    'field@demo.local',    'FIELD_USER',         'HFW', TRUE),
  ('Demo Field 2',  'field2@demo.local',   'FIELD_USER',         'HFW', TRUE),
  ('Demo Inactive', 'inactive@demo.local', 'FIELD_USER',         'HFW', FALSE)
) AS v(name, email, role, dept_code, is_active)
JOIN departments d ON d.code = v.dept_code;

-- field@demo.local is assigned to two activities (everything else stays unassigned,
-- which makes the ownership rules easy to demonstrate).
INSERT INTO activity_assignments (activity_id, user_id, assigned_by)
SELECT act.id, fu.id, ab.id
FROM (VALUES
  ('Structural works - floors 3 to 7'),
  ('Electrical and MEP installation')
) AS v(activity_title)
JOIN activities act ON act.title = v.activity_title
JOIN users fu ON fu.email = 'field@demo.local'
JOIN users ab ON ab.email = 'officer@demo.local';
