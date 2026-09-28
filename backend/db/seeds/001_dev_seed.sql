-- 001_dev_seed.sql  (DEVELOPMENT DATA ONLY - all names/figures are fictional samples)
-- Wipes all app tables, then inserts a small dataset that tells the lifecycle story.
-- Rows are linked by natural keys (department code, user email, asset_code, activity title),
-- so no hard-coded UUIDs are needed.

TRUNCATE asset_responsibilities, activity_assignments, maintenance_records, inspections, activities,
         lifecycle_events, infrastructure_assets, users, departments;

-- ---------------------------------------------------------- departments
INSERT INTO departments (name, code, description) VALUES
  ('Health and Family Welfare Department',  'HFW',  'Hospitals, medical colleges and public health infrastructure'),
  ('Roads and Buildings Department',        'RNB',  'State highways, bridges and public roads'),
  ('Western Railway Infrastructure Wing',   'WRIW', 'Railway tracks, yards and rail-linked structures'),
  ('Urban Development Department',          'UDD',  'Municipal and civic buildings and urban infrastructure'),
  ('General Administration Department',     'GAD',  'Secretariat and government office buildings');

-- ---------------------------------------------------------------- users
INSERT INTO users (name, email, role, department_id)
SELECT v.name, v.email, v.role::user_role, d.id
FROM (VALUES
  ('Rajesh Mehta',   'rajesh.mehta@infra.example.gov.in',   'ADMIN',              'GAD'),
  ('Priya Shah',     'priya.shah@infra.example.gov.in',     'GOVERNMENT_OFFICER', 'HFW'),
  ('Amit Patel',     'amit.patel@infra.example.gov.in',     'GOVERNMENT_OFFICER', 'RNB'),
  ('Kavita Desai',   'kavita.desai@infra.example.gov.in',   'GOVERNMENT_OFFICER', 'WRIW'),
  ('Meera Trivedi',  'meera.trivedi@infra.example.gov.in',  'GOVERNMENT_OFFICER', 'UDD'),
  ('Suresh Solanki', 'suresh.solanki@infra.example.gov.in', 'FIELD_USER',         'RNB'),
  ('Nisha Parmar',   'nisha.parmar@infra.example.gov.in',   'FIELD_USER',         'HFW'),
  ('Imran Sheikh',   'imran.sheikh@infra.example.gov.in',   'FIELD_USER',         'WRIW')
) AS v(name, email, role, dept_code)
JOIN departments d ON d.code = v.dept_code;

-- ------------------------------------------------ infrastructure_assets
INSERT INTO infrastructure_assets
  (asset_code, name, asset_type, description, department_id, location, latitude, longitude,
   lifecycle_status, construction_start_date, completion_date, expected_end_of_life_date)
SELECT v.asset_code, v.name, v.asset_type::asset_type, v.description, d.id, v.location,
       v.latitude::numeric, v.longitude::numeric, v.status::lifecycle_status,
       v.start_date::date, v.completion_date::date, v.eol_date::date
FROM (VALUES
  ('HOS-AMD-001', 'Ahmedabad District Hospital', 'HOSPITAL',
   '750-bed district hospital with trauma and maternity wings.', 'HFW',
   'Asarwa, Ahmedabad, Gujarat', 23.0510, 72.6040, 'OPERATIONAL', '2019-03-01', '2022-06-30', '2072-06-30'),
  ('HOS-SRT-002', 'Surat Civil Hospital - New Trauma Care Block', 'HOSPITAL',
   'Seven-storey trauma block adjoining the existing civil hospital.', 'HFW',
   'Majura Gate, Surat, Gujarat', 21.1850, 72.8190, 'UNDER_CONSTRUCTION', '2025-02-10', NULL, '2075-12-31'),
  ('HWY-SH09-003', 'State Highway 9 - Rajkot to Jamnagar Corridor', 'HIGHWAY',
   'Four-lane state highway corridor, 92 km.', 'RNB',
   'Rajkot - Jamnagar, Saurashtra, Gujarat', 22.3039, 70.8022, 'UNDER_MAINTENANCE', '2008-04-01', '2011-03-31', '2041-03-31'),
  ('RLY-SUR-004', 'Surat-Udhna Railway Track Section', 'RAILWAY',
   'Double-line broad gauge section serving the Surat-Udhna yard.', 'WRIW',
   'Surat - Udhna, Gujarat', 21.1700, 72.8380, 'REHABILITATION', '1996-06-01', '1998-12-31', '2031-12-31'),
  ('BLD-GNR-005', 'Old Secretariat Annexe, Gandhinagar', 'PUBLIC_BUILDING',
   'Five-storey RCC office annexe built in the late 1960s.', 'GAD',
   'Sector 11, Gandhinagar, Gujarat', 23.2156, 72.6369, 'END_OF_LIFE', '1968-01-15', '1971-05-30', '2025-12-31'),
  ('BRG-SRT-006', 'Tapi River Bridge (Kapodra-Varachha Link)', 'BRIDGE',
   'Six-lane prestressed concrete girder bridge over the Tapi.', 'RNB',
   'Surat, Gujarat', 21.2010, 72.8640, 'OPERATIONAL', '2012-01-10', '2015-11-20', '2065-11-20'),
  ('BLD-RJT-007', 'Rajkot Civic Services Centre', 'PUBLIC_BUILDING',
   'Proposed single-window civic services building.', 'UDD',
   'Kalawad Road, Rajkot, Gujarat', 22.2900, 70.7700, 'PLANNED', NULL, NULL, '2076-03-31'),
  ('BRG-VAD-008', 'Old Mahisagar River Bridge (Vasad Link)', 'BRIDGE',
   'Masonry-and-steel bridge retired after the new parallel bridge opened.', 'RNB',
   'Vasad, Anand - Vadodara, Gujarat', 22.4700, 73.0700, 'DECOMMISSIONED', '1958-03-01', '1961-01-26', '2021-12-31')
) AS v(asset_code, name, asset_type, description, dept_code, location, latitude, longitude,
       status, start_date, completion_date, eol_date)
JOIN departments d ON d.code = v.dept_code;

-- ------------------------------------------------------ lifecycle_events
INSERT INTO lifecycle_events
  (asset_id, event_type, event_date, title, description, progress_percentage, recorded_by)
SELECT a.id, v.event_type::lifecycle_event_type, v.event_date::date, v.title, v.description,
       v.progress::int, u.id
FROM (VALUES
  -- HOS-AMD-001: full journey to operational, then maintenance
  ('HOS-AMD-001','PLANNED','2018-06-10','Project sanctioned','Administrative and financial sanction granted.',NULL,'priya.shah'),
  ('HOS-AMD-001','CONSTRUCTION_STARTED','2019-03-01','Construction started','Foundation excavation began.',0,'priya.shah'),
  ('HOS-AMD-001','CONSTRUCTION_PROGRESS','2019-12-15','Progress 25%','Foundation and ground floor slab complete.',25,'nisha.parmar'),
  ('HOS-AMD-001','CONSTRUCTION_PROGRESS','2020-11-20','Progress 50%','Superstructure complete up to fourth floor.',50,'nisha.parmar'),
  ('HOS-AMD-001','CONSTRUCTION_PROGRESS','2021-09-30','Progress 75%','Structure complete; finishing and MEP works underway.',75,'nisha.parmar'),
  ('HOS-AMD-001','CONSTRUCTION_PROGRESS','2022-05-25','Progress 100%','All civil and MEP works finished.',100,'nisha.parmar'),
  ('HOS-AMD-001','CONSTRUCTION_COMPLETED','2022-06-30','Construction completed','Building handed over; asset is now operational.',100,'priya.shah'),
  ('HOS-AMD-001','INSPECTION','2024-02-12','Annual structural inspection','Structure in good condition.',NULL,'nisha.parmar'),
  ('HOS-AMD-001','MAINTENANCE_STARTED','2025-01-20','HVAC and plumbing overhaul started',NULL,NULL,'priya.shah'),
  ('HOS-AMD-001','MAINTENANCE_COMPLETED','2025-04-10','HVAC and plumbing overhaul completed',NULL,NULL,'priya.shah'),

  -- HOS-SRT-002: currently under construction
  ('HOS-SRT-002','PLANNED','2024-08-05','Project sanctioned','Approved under state health infrastructure plan.',NULL,'priya.shah'),
  ('HOS-SRT-002','CONSTRUCTION_STARTED','2025-02-10','Construction started','Site handed over to contractor.',0,'priya.shah'),
  ('HOS-SRT-002','INSPECTION','2025-04-10','Foundation pile integrity test','All tested piles passed.',NULL,'nisha.parmar'),
  ('HOS-SRT-002','CONSTRUCTION_PROGRESS','2025-07-15','Progress 25%','Foundation and basement complete.',25,'nisha.parmar'),
  ('HOS-SRT-002','CONSTRUCTION_PROGRESS','2026-02-10','Progress 50%','Structure up to third floor.',50,'nisha.parmar'),
  ('HOS-SRT-002','CONSTRUCTION_PROGRESS','2026-08-20','Progress 65%','Fifth floor slab cast; MEP rough-in started.',65,'nisha.parmar'),

  -- HWY-SH09-003: built, now under maintenance
  ('HWY-SH09-003','PLANNED','2007-06-01','Corridor upgrade sanctioned',NULL,NULL,'amit.patel'),
  ('HWY-SH09-003','CONSTRUCTION_STARTED','2008-04-01','Construction started',NULL,0,'amit.patel'),
  ('HWY-SH09-003','CONSTRUCTION_PROGRESS','2009-02-15','Progress 30%','Earthwork and sub-base complete.',30,'suresh.solanki'),
  ('HWY-SH09-003','CONSTRUCTION_PROGRESS','2010-01-10','Progress 60%','Bituminous base course laid.',60,'suresh.solanki'),
  ('HWY-SH09-003','CONSTRUCTION_PROGRESS','2011-01-20','Progress 90%','Wearing course and road furniture underway.',90,'suresh.solanki'),
  ('HWY-SH09-003','CONSTRUCTION_COMPLETED','2011-03-31','Construction completed','Corridor opened to traffic.',100,'amit.patel'),
  ('HWY-SH09-003','INSPECTION','2023-11-05','Pavement condition survey','Extensive cracking and potholes between km 120 and 162.',NULL,'suresh.solanki'),
  ('HWY-SH09-003','MAINTENANCE_STARTED','2026-07-01','Resurfacing of km 120-162 started',NULL,NULL,'amit.patel'),

  -- RLY-SUR-004: track under rehabilitation
  ('RLY-SUR-004','PLANNED','1995-08-01','Section doubling sanctioned',NULL,NULL,'kavita.desai'),
  ('RLY-SUR-004','CONSTRUCTION_STARTED','1996-06-01','Construction started',NULL,0,'kavita.desai'),
  ('RLY-SUR-004','CONSTRUCTION_PROGRESS','1997-08-01','Progress 50%','Formation and one line laid.',50,'imran.sheikh'),
  ('RLY-SUR-004','CONSTRUCTION_COMPLETED','1998-12-31','Construction completed','Double line commissioned.',100,'kavita.desai'),
  ('RLY-SUR-004','INSPECTION','2024-03-18','Track geometry and safety inspection','Rail wear and ballast fouling beyond limits.',NULL,'imran.sheikh'),
  ('RLY-SUR-004','REHABILITATION','2026-03-01','Track renewal started','Rail, sleeper and ballast renewal in phases.',NULL,'kavita.desai'),

  -- BLD-GNR-005: end of life
  ('BLD-GNR-005','PLANNED','1967-04-01','Annexe building sanctioned',NULL,NULL,'rajesh.mehta'),
  ('BLD-GNR-005','CONSTRUCTION_STARTED','1968-01-15','Construction started',NULL,0,'rajesh.mehta'),
  ('BLD-GNR-005','CONSTRUCTION_COMPLETED','1971-05-30','Construction completed','Building occupied.',100,'rajesh.mehta'),
  ('BLD-GNR-005','INSPECTION','2023-09-12','Structural audit','Severe spalling and corroded reinforcement in columns.',NULL,'suresh.solanki'),
  ('BLD-GNR-005','END_OF_LIFE_ASSESSMENT','2025-06-20','End-of-life assessment','Retrofitting uneconomical; recommended for demolition.',NULL,'meera.trivedi'),

  -- BRG-SRT-006: operational, deteriorating
  ('BRG-SRT-006','PLANNED','2011-05-10','Bridge sanctioned',NULL,NULL,'amit.patel'),
  ('BRG-SRT-006','CONSTRUCTION_STARTED','2012-01-10','Construction started',NULL,0,'amit.patel'),
  ('BRG-SRT-006','CONSTRUCTION_PROGRESS','2013-05-20','Progress 40%','Piers and abutments complete.',40,'suresh.solanki'),
  ('BRG-SRT-006','CONSTRUCTION_PROGRESS','2014-09-15','Progress 80%','Girders launched; deck slab underway.',80,'suresh.solanki'),
  ('BRG-SRT-006','CONSTRUCTION_COMPLETED','2015-11-20','Construction completed','Bridge opened to traffic.',100,'amit.patel'),
  ('BRG-SRT-006','INSPECTION','2025-11-12','Annual bridge inspection','Minor bearing wear noted.',NULL,'suresh.solanki'),
  ('BRG-SRT-006','INSPECTION','2026-05-18','Follow-up bridge inspection','Expansion joint damage and new deck cracks.',NULL,'suresh.solanki'),

  -- BLD-RJT-007: planned
  ('BLD-RJT-007','PLANNED','2026-08-01','Project proposed','Proposal approved in principle.',NULL,'meera.trivedi'),
  ('BLD-RJT-007','OTHER','2026-09-10','Land allotment finalised','Site allotted by the municipal corporation.',NULL,'meera.trivedi'),

  -- BRG-VAD-008: full lifecycle ending in decommissioning
  ('BRG-VAD-008','PLANNED','1957-09-01','Bridge sanctioned',NULL,NULL,'amit.patel'),
  ('BRG-VAD-008','CONSTRUCTION_STARTED','1958-03-01','Construction started',NULL,0,'amit.patel'),
  ('BRG-VAD-008','CONSTRUCTION_COMPLETED','1961-01-26','Construction completed','Bridge opened to traffic.',100,'amit.patel'),
  ('BRG-VAD-008','INSPECTION','2019-10-04','Structural inspection','Girders and piers severely deteriorated.',NULL,'suresh.solanki'),
  ('BRG-VAD-008','END_OF_LIFE_ASSESSMENT','2021-03-15','End-of-life assessment','Declared unsafe; replaced by new parallel bridge.',NULL,'amit.patel'),
  ('BRG-VAD-008','DECOMMISSIONED','2021-12-31','Bridge decommissioned','Closed to all traffic and barricaded.',NULL,'amit.patel')
) AS v(asset_code, event_type, event_date, title, description, progress, user_name)
JOIN infrastructure_assets a ON a.asset_code = v.asset_code
JOIN users u ON u.email = v.user_name || '@infra.example.gov.in';

-- ----------------------------------------------------------- activities
INSERT INTO activities
  (asset_id, title, description, activity_type, status, priority,
   start_date, due_date, completed_at, progress_percentage, created_by)
SELECT a.id, v.title, v.description, v.activity_type::activity_type, v.status::activity_status,
       v.priority::activity_priority, v.start_date::date, v.due_date::date,
       v.completed_at::timestamptz, v.progress::int, u.id
FROM (VALUES
  ('HOS-SRT-002','Foundation pile integrity testing','Test all bored piles of the trauma block.','INSPECTION','COMPLETED','MEDIUM','2025-03-01','2025-04-15','2025-04-10',100,'priya.shah'),
  ('HOS-SRT-002','Structural works - floors 3 to 7','RCC frame, slabs and masonry for upper floors.','CONSTRUCTION','IN_PROGRESS','HIGH','2026-02-10','2026-12-15',NULL,65,'priya.shah'),
  ('HOS-SRT-002','Electrical and MEP installation','Electrical, plumbing, HVAC and medical gas piping.','CONSTRUCTION','TODO','MEDIUM','2026-10-01','2027-03-31',NULL,0,'priya.shah'),
  ('HOS-AMD-001','Annual HVAC servicing','Servicing of chillers and air handling units.','MAINTENANCE','COMPLETED','LOW','2025-01-20','2025-04-15','2025-04-10',100,'priya.shah'),
  ('HWY-SH09-003','Resurfacing of SH-9 km 120-162','Milling and bituminous overlay of the damaged stretch.','MAINTENANCE','IN_PROGRESS','CRITICAL','2026-07-01','2026-11-30',NULL,45,'amit.patel'),
  ('HWY-SH09-003','Pothole repair - Jamnagar approach','Patch repairs; blocked awaiting bitumen supply.','REPAIR','BLOCKED','HIGH','2026-08-01','2026-09-15',NULL,20,'amit.patel'),
  ('RLY-SUR-004','Track renewal - Udhna yard section','Renewal of rails, sleepers and ballast in phases.','REHABILITATION','IN_PROGRESS','HIGH','2026-03-01','2027-01-31',NULL,55,'kavita.desai'),
  ('RLY-SUR-004','Signal cabling inspection','Inspect cabling before track renewal reaches the signals.','INSPECTION','TODO','MEDIUM','2026-10-05','2026-10-20',NULL,0,'kavita.desai'),
  ('BRG-SRT-006','Expansion joint and bearing replacement','Replace damaged joints and worn bearings.','REPAIR','TODO','CRITICAL','2026-10-05','2027-02-28',NULL,0,'amit.patel'),
  ('BRG-SRT-006','Deck crack monitoring','Monthly crack-width monitoring on the deck slab.','INSPECTION','IN_PROGRESS','HIGH','2026-06-01','2026-12-31',NULL,30,'amit.patel'),
  ('BLD-GNR-005','Demolition planning and safety survey','Survey and method statement for safe demolition.','OTHER','IN_PROGRESS','MEDIUM','2026-07-15','2026-11-15',NULL,25,'meera.trivedi'),
  ('BLD-RJT-007','Site survey and DPR preparation','Topographic survey and detailed project report.','OTHER','IN_PROGRESS','MEDIUM','2026-09-01','2026-12-31',NULL,40,'meera.trivedi')
) AS v(asset_code, title, description, activity_type, status, priority,
       start_date, due_date, completed_at, progress, user_name)
JOIN infrastructure_assets a ON a.asset_code = v.asset_code
JOIN users u ON u.email = v.user_name || '@infra.example.gov.in';

-- --------------------------------------------------- activity_assignments
INSERT INTO activity_assignments (activity_id, user_id, assigned_by)
SELECT act.id, fu.id, ab.id
FROM (VALUES
  ('Foundation pile integrity testing',          'nisha.parmar',   'priya.shah'),
  ('Structural works - floors 3 to 7',           'nisha.parmar',   'priya.shah'),
  ('Electrical and MEP installation',            'nisha.parmar',   'priya.shah'),
  ('Annual HVAC servicing',                      'nisha.parmar',   'priya.shah'),
  ('Resurfacing of SH-9 km 120-162',             'suresh.solanki', 'amit.patel'),
  ('Pothole repair - Jamnagar approach',         'suresh.solanki', 'amit.patel'),
  ('Track renewal - Udhna yard section',         'imran.sheikh',   'kavita.desai'),
  ('Signal cabling inspection',                  'imran.sheikh',   'kavita.desai'),
  ('Expansion joint and bearing replacement',    'suresh.solanki', 'amit.patel'),
  ('Deck crack monitoring',                      'suresh.solanki', 'amit.patel'),
  ('Demolition planning and safety survey',      'suresh.solanki', 'meera.trivedi')
) AS v(activity_title, assignee, assigner)
JOIN activities act ON act.title = v.activity_title
JOIN users fu ON fu.email = v.assignee || '@infra.example.gov.in'
JOIN users ab ON ab.email = v.assigner || '@infra.example.gov.in';

-- ----------------------------------------------------------- inspections
INSERT INTO inspections
  (asset_id, inspection_date, inspection_type, condition_status, findings, recommendations, conducted_by)
SELECT a.id, v.inspection_date::date, v.inspection_type::inspection_type,
       v.condition_status::condition_status, v.findings, v.recommendations, u.id
FROM (VALUES
  ('HOS-AMD-001','2024-02-12','STRUCTURAL','GOOD','No structural distress observed.','Continue routine annual inspection.','nisha.parmar'),
  ('HOS-SRT-002','2025-04-10','STRUCTURAL','GOOD','All tested piles met integrity criteria.','Proceed with pile caps.','nisha.parmar'),
  ('HWY-SH09-003','2023-11-05','ROUTINE','POOR','Extensive cracking and potholes between km 120 and 162.','Full-depth resurfacing of the affected stretch.','suresh.solanki'),
  ('RLY-SUR-004','2024-03-18','SAFETY','POOR','Rail wear and ballast fouling beyond permissible limits.','Renew rails, sleepers and ballast.','imran.sheikh'),
  ('BLD-GNR-005','2023-09-12','STRUCTURAL','CRITICAL','Severe spalling and corroded reinforcement in columns.','Vacate building; assess for demolition.','suresh.solanki'),
  ('BRG-SRT-006','2025-11-12','STRUCTURAL','FAIR','Minor bearing wear.','Monitor; plan bearing replacement.','suresh.solanki'),
  ('BRG-SRT-006','2026-05-18','STRUCTURAL','POOR','Expansion joint damage and new deck cracks.','Replace joints and bearings; monitor cracks monthly.','suresh.solanki'),
  ('BRG-VAD-008','2019-10-04','STRUCTURAL','CRITICAL','Girders and piers severely deteriorated.','Close to traffic and decommission.','suresh.solanki')
) AS v(asset_code, inspection_date, inspection_type, condition_status, findings, recommendations, user_name)
JOIN infrastructure_assets a ON a.asset_code = v.asset_code
JOIN users u ON u.email = v.user_name || '@infra.example.gov.in';

-- ---------------------------------------------------- maintenance_records
INSERT INTO maintenance_records
  (asset_id, maintenance_type, title, description, start_date, completion_date, cost, status, performed_by)
SELECT a.id, v.maintenance_type::maintenance_type, v.title, v.description,
       v.start_date::date, v.completion_date::date, v.cost::numeric, v.status::maintenance_status, u.id
FROM (VALUES
  ('HOS-AMD-001','PREVENTIVE','HVAC and plumbing overhaul','Overhaul of chillers, pumps and piping.','2025-01-20','2025-04-10',4850000.00,'COMPLETED','nisha.parmar'),
  ('HWY-SH09-003','CORRECTIVE','Resurfacing km 120-162','Milling and 50 mm bituminous overlay.','2026-07-01',NULL,18600000.00,'IN_PROGRESS','suresh.solanki'),
  ('HWY-SH09-003','EMERGENCY','Pothole repair - Jamnagar approach','Patch repairs on the approach road.',NULL,NULL,750000.00,'PLANNED','suresh.solanki'),
  ('RLY-SUR-004','PREVENTIVE','Ballast cleaning and tamping','Cleaning and tamping of the yard section.','2025-02-01','2025-03-05',2100000.00,'COMPLETED','imran.sheikh'),
  ('BRG-SRT-006','CORRECTIVE','Expansion joint replacement','Replace damaged joints and worn bearings.','2026-10-05',NULL,12500000.00,'PLANNED',NULL)
) AS v(asset_code, maintenance_type, title, description, start_date, completion_date, cost, status, user_name)
JOIN infrastructure_assets a ON a.asset_code = v.asset_code
LEFT JOIN users u ON u.email = v.user_name || '@infra.example.gov.in';
