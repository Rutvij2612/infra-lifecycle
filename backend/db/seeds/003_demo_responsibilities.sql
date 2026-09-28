-- 003_demo_responsibilities.sql  (DEVELOPMENT / DEMO ONLY)
-- Field Officer -> asset responsibility assignments. Access for field users comes ONLY from
-- these rows (not from department or activity assignment).
--   field@demo.local   : CONSTRUCTION of HOS-SRT-002 (also holds 2 activity assignments - a separate concept)
--   field2@demo.local  : MAINTENANCE of HOS-AMD-001 (no activity assignments at all)
--   Suresh Solanki     : MAINTENANCE of HWY-SH09-003
-- Nisha Parmar and Imran Sheikh intentionally have no responsibilities (no asset access).
INSERT INTO asset_responsibilities (asset_id, user_id, responsibility_type, assigned_by)
SELECT a.id, fu.id, v.rtype::responsibility_type, ab.id
FROM (VALUES
  ('HOS-SRT-002',  'field@demo.local',                     'CONSTRUCTION', 'priya.shah@infra.example.gov.in'),
  ('HOS-AMD-001',  'field2@demo.local',                    'MAINTENANCE',  'priya.shah@infra.example.gov.in'),
  ('HWY-SH09-003', 'suresh.solanki@infra.example.gov.in',  'MAINTENANCE',  'amit.patel@infra.example.gov.in')
) AS v(asset_code, field_email, rtype, assigner_email)
JOIN infrastructure_assets a ON a.asset_code = v.asset_code
JOIN users fu ON fu.email = v.field_email
JOIN users ab ON ab.email = v.assigner_email;
