// Smoke test for Checkpoint 04 (auth + RBAC) and Checkpoint 04.1 (Field Officer responsibility model). Run against a live API with a freshly seeded DB:
//   npm run db:setup && npm run dev   (in another terminal)   ->   npm run test:smoke
// Env: API_URL (default http://localhost:4000/api), JWT_SECRET (needed to forge expired/foreign tokens).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

const API = process.env.API_URL ?? 'http://localhost:4000/api';
const SECRET = process.env.JWT_SECRET ?? '';
const PW = 'Demo@12345';
let passed = 0;
const failures = [];

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, body: json, text };
}
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name} ${extra}`); }
}
const expectStatus = (name, res, status, code) =>
  check(name, res.status === status && (!code || res.body?.error?.code === code), `(got ${res.status} ${res.body?.error?.code ?? ''})`);

const login = async (email, password = PW) => call('POST', '/auth/login', { body: { email, password } });
const tokenOf = async (email) => (await login(email)).body.data.token;

console.log('\n== Health (public)');
expectStatus('GET /health without token', await call('GET', '/health'), 200);
expectStatus('GET /health/db without token', await call('GET', '/health/db'), 200);

console.log('\n== Login');
const adminLogin = await login('admin@demo.local');
const officerLogin = await login('officer@demo.local');
const fieldLogin = await login('field@demo.local');
const field2Login = await login('field2@demo.local');
check('admin login 200 + token', adminLogin.status === 200 && !!adminLogin.body.data.token);
check('officer login 200 + token', officerLogin.status === 200 && !!officerLogin.body.data.token);
check('field login 200 + token', fieldLogin.status === 200 && !!fieldLogin.body.data.token);
check('roles are correct', adminLogin.body.data.user.role === 'ADMIN' && officerLogin.body.data.user.role === 'GOVERNMENT_OFFICER' && fieldLogin.body.data.user.role === 'FIELD_USER');
check('login response has no password/hash', !/password|\$2[aby]\$/i.test(adminLogin.text));
const decoded = jwt.decode(adminLogin.body.data.token);
check('JWT holds only sub/role/email/iat/exp', Object.keys(decoded).sort().join() === 'email,exp,iat,role,sub');
const bad = await login('admin@demo.local', 'wrong-password');
const unknown = await login('nobody@demo.local', 'whatever123');
const inactive = await login('inactive@demo.local');
expectStatus('wrong password -> 401 INVALID_CREDENTIALS', bad, 401, 'INVALID_CREDENTIALS');
expectStatus('unknown email -> 401 INVALID_CREDENTIALS', unknown, 401, 'INVALID_CREDENTIALS');
expectStatus('inactive user -> 401 INVALID_CREDENTIALS', inactive, 401, 'INVALID_CREDENTIALS');
check('wrong-password / unknown / inactive responses are identical (no enumeration)',
  bad.text === unknown.text && bad.text === inactive.text);
expectStatus('missing credentials -> 400', await call('POST', '/auth/login', { body: {} }), 400);
expectStatus('email is case-insensitive', await login('ADMIN@Demo.Local'), 200);

console.log('\n== Token handling');
expectStatus('no token -> 401', await call('GET', '/auth/me'), 401, 'UNAUTHENTICATED');
expectStatus('malformed token -> 401', await call('GET', '/auth/me', { token: 'not.a.jwt' }), 401, 'INVALID_TOKEN');
expectStatus('garbage scheme -> 401', (await fetch(`${API}/auth/me`, { headers: { Authorization: 'Basic abc' } })).status === 401 ? { status: 401, body: { error: { code: 'INVALID_TOKEN' } } } : { status: 0 }, 401);
if (SECRET) {
  const uid = decoded.sub;
  const expired = jwt.sign({ role: 'ADMIN', email: 'admin@demo.local' }, SECRET, { subject: uid, expiresIn: -60 });
  expectStatus('expired token -> 401 TOKEN_EXPIRED', await call('GET', '/auth/me', { token: expired }), 401, 'TOKEN_EXPIRED');
  const foreign = jwt.sign({ role: 'ADMIN', email: 'admin@demo.local' }, 'some-other-secret', { subject: uid });
  expectStatus('token signed with wrong secret -> 401', await call('GET', '/auth/me', { token: foreign }), 401, 'INVALID_TOKEN');
  const none = jwt.sign({ role: 'ADMIN', email: 'admin@demo.local' }, '', { subject: uid, algorithm: 'none' });
  expectStatus('alg=none token -> 401', await call('GET', '/auth/me', { token: none }), 401, 'INVALID_TOKEN');
  // Token claims ADMIN but DB role is FIELD_USER -> DB wins.
  const fieldId = jwt.decode(fieldLogin.body.data.token).sub;
  const escalated = jwt.sign({ role: 'ADMIN', email: 'field@demo.local' }, SECRET, { subject: fieldId });
  expectStatus('forged role claim ignored (DB role wins)', await call('GET', '/users', { token: escalated }), 403);
} else console.log('  (skipped forged-token checks: set JWT_SECRET)');

console.log('\n== /auth/me');
const A = adminLogin.body.data.token, O = officerLogin.body.data.token, F = fieldLogin.body.data.token, F2 = field2Login.body.data.token;
const me = await call('GET', '/auth/me', { token: O });
check('me returns profile with department, no hash', me.status === 200 && me.body.data.email === 'officer@demo.local' && !!me.body.data.department?.name && !/password/i.test(me.text));
const officerId = me.body.data.id;
const fieldId = fieldLogin.body.data.user.id;
const field2Id = field2Login.body.data.user.id;

console.log('\n== Unauthenticated access to protected routes');
for (const [m, p] of [['GET', '/assets'], ['POST', '/assets'], ['GET', '/users'], ['GET', '/departments'], ['PATCH', '/activities/x'], ['GET', '/activities/mine']]) {
  expectStatus(`${m} ${p} without token -> 401`, await call(m, p, { body: m === 'GET' ? undefined : {} }), 401);
}

console.log('\n== User management');
expectStatus('field GET /users -> 403', await call('GET', '/users', { token: F }), 403, 'FORBIDDEN');
const ul = await call('GET', '/users', { token: A });
check('admin GET /users -> all roles, no hash', ul.status === 200 && ul.body.data.length >= 12 && !/password|\$2[aby]\$/i.test(ul.text));
const ol = await call('GET', '/users', { token: O });
check('officer GET /users -> active FIELD_USERs only', ol.status === 200 && ol.body.data.length > 0 && ol.body.data.every((u) => u.role === 'FIELD_USER' && u.is_active));
const dept = (await call('GET', '/departments', { token: F }));
check('any user can list departments', dept.status === 200 && dept.body.data.length >= 5);
const hfw = dept.body.data.find((d) => d.code === 'HFW').id;
const rnb = dept.body.data.find((d) => d.code === 'RNB').id;
const runId = Math.floor(Math.random() * 1000000);
const smokeEmail = `Smoke.Tester.${runId}@Demo.Local`;
const smokeEmailLower = smokeEmail.toLowerCase();
const newUser = { name: 'Smoke Tester', email: smokeEmail, password: 'Sm0ke-Pass!', role: 'FIELD_USER', department_id: hfw };
expectStatus('officer POST /users -> 403', await call('POST', '/users', { token: O, body: newUser }), 403);
expectStatus('field POST /users -> 403', await call('POST', '/users', { token: F, body: newUser }), 403);
const created = await call('POST', '/users', { token: A, body: newUser });
check('admin POST /users -> 201, email lower-cased, no hash', created.status === 201 && created.body.data.email === smokeEmailLower && !/password/i.test(created.text));
expectStatus('duplicate email (different case) -> 409', await call('POST', '/users', { token: A, body: { ...newUser, email: smokeEmail.toUpperCase() } }), 409, 'EMAIL_IN_USE');
expectStatus('invalid email -> 400', await call('POST', '/users', { token: A, body: { ...newUser, email: 'nope' } }), 400);
expectStatus('invalid role -> 400', await call('POST', '/users', { token: A, body: { ...newUser, email: 'r@demo.local', role: 'SUPERUSER' } }), 400);
expectStatus('invalid department -> 400', await call('POST', '/users', { token: A, body: { ...newUser, email: 'd@demo.local', department_id: '00000000-0000-0000-0000-000000000000' } }), 400, 'INVALID_REFERENCE');
expectStatus('short password -> 400', await call('POST', '/users', { token: A, body: { ...newUser, email: 'p@demo.local', password: 'short' } }), 400);
expectStatus('new user can log in', await login(smokeEmailLower, 'Sm0ke-Pass!'), 200);
expectStatus('admin GET /users/:id -> 200', await call('GET', `/users/${created.body.data.id}`, { token: A }), 200);
expectStatus('officer GET /users/:id -> 403', await call('GET', `/users/${created.body.data.id}`, { token: O }), 403);
const smokeToken = (await login(smokeEmailLower, 'Sm0ke-Pass!')).body.data.token;
expectStatus('smoke user token works before deactivation', await call('GET', '/auth/me', { token: smokeToken }), 200);
expectStatus('admin PATCH user (deactivate) -> 200', await call('PATCH', `/users/${created.body.data.id}`, { token: A, body: { is_active: false } }), 200);
expectStatus('existing token of deactivated user -> 401', await call('GET', '/auth/me', { token: smokeToken }), 401);
expectStatus('deactivated user cannot log in', await login(smokeEmailLower, 'Sm0ke-Pass!'), 401, 'INVALID_CREDENTIALS');
expectStatus('officer PATCH user -> 403', await call('PATCH', `/users/${created.body.data.id}`, { token: O, body: { name: 'x' } }), 403);
expectStatus('admin cannot demote self -> 400', await call('PATCH', `/users/${jwt.decode(A).sub}`, { token: A, body: { role: 'FIELD_USER' } }), 400, 'SELF_LOCKOUT');

console.log('\n== Assets');
const assets = (await call('GET', '/assets?limit=100', { token: A })).body.data;
const byCode = (c) => assets.find((a) => a.asset_code === c);
const srt = byCode('HOS-SRT-002'), amd = byCode('HOS-AMD-001'), hwy = byCode('HWY-SH09-003');
const fl = await call('GET', '/assets?limit=100', { token: F });
check('field list = only assets with a responsibility assignment (SRT-002), NOT the whole department',
  fl.status === 200 && fl.body.data.length === 1 && fl.body.data[0].id === srt.id);
check('field list pagination total matches', fl.body.pagination.total === fl.body.data.length);
check('officer list sees everything', (await call('GET', '/assets?limit=100', { token: O })).body.data.length === assets.length);
expectStatus('field GET responsible asset -> 200', await call('GET', `/assets/${srt.id}`, { token: F }), 200);
expectStatus('field GET same-department asset without responsibility -> 403 (department alone grants nothing)', await call('GET', `/assets/${amd.id}`, { token: F }), 403, 'FORBIDDEN');
expectStatus('field GET unrelated asset -> 403', await call('GET', `/assets/${hwy.id}`, { token: F }), 403, 'FORBIDDEN');
const newAsset = (code) => ({ asset_code: `${code}-${runId}`, name: 'Smoke Bridge', asset_type: 'BRIDGE', department_id: rnb });
expectStatus('field POST /assets -> 403', await call('POST', '/assets', { token: F, body: newAsset('SMK-F-1') }), 403, 'FORBIDDEN');
const oa = await call('POST', '/assets', { token: O, body: newAsset('SMK-O-1') });
expectStatus('officer POST /assets -> 201', oa, 201);
const aa = await call('POST', '/assets', { token: A, body: newAsset('SMK-A-1') });
expectStatus('admin POST /assets -> 201', aa, 201);
expectStatus('officer PATCH asset -> 200', await call('PATCH', `/assets/${oa.body.data.id}`, { token: O, body: { name: 'Renamed' } }), 200);
expectStatus('field PATCH asset -> 403', await call('PATCH', `/assets/${amd.id}`, { token: F, body: { name: 'Hacked' } }), 403);
expectStatus('field GET asset without token param bad uuid -> 400', await call('GET', '/assets/not-a-uuid', { token: F }), 400);

console.log('\n== Lifecycle');
const lc = { event_type: 'CONSTRUCTION_STARTED', event_date: '2026-09-01', title: 'Start', recorded_by: fieldId };
const fLc = await call('POST', `/assets/${srt.id}/lifecycle`, { token: F, body: { event_type: 'CONSTRUCTION_PROGRESS', event_date: '2026-09-15', title: 'Progress 70%', progress_percentage: 70, recorded_by: officerId } });
check('responsible field officer POST CONSTRUCTION_PROGRESS -> 201, recorded_by = self (spoof ignored)', fLc.status === 201 && fLc.body?.data?.event?.recorded_by === fieldId && fLc.body?.data?.event?.progress_percentage === 70, JSON.stringify(fLc));
expectStatus('field POST REHABILITATION (governance event) -> 403', await call('POST', `/assets/${srt.id}/lifecycle`, { token: F, body: { ...lc, event_type: 'REHABILITATION' } }), 403, 'FORBIDDEN');
expectStatus('field (CONSTRUCTION only) POST MAINTENANCE_STARTED -> 403', await call('POST', `/assets/${srt.id}/lifecycle`, { token: F, body: { ...lc, event_type: 'MAINTENANCE_STARTED' } }), 403, 'FORBIDDEN');
expectStatus('field POST lifecycle on same-department asset without responsibility -> 403', await call('POST', `/assets/${amd.id}/lifecycle`, { token: F, body: { ...lc, event_type: 'CONSTRUCTION_PROGRESS' } }), 403);
expectStatus('field POST lifecycle on unrelated asset -> 403', await call('POST', `/assets/${hwy.id}/lifecycle`, { token: F, body: { ...lc, event_type: 'CONSTRUCTION_PROGRESS' } }), 403);
const lcOfficer = await call('POST', `/assets/${oa.body.data.id}/lifecycle`, { token: O, body: lc });
check('officer POST lifecycle -> 201, status moves, recorded_by = officer (spoof ignored)',
  lcOfficer.status === 201 && lcOfficer.body.data.asset.lifecycle_status === 'UNDER_CONSTRUCTION' && lcOfficer.body.data.event.recorded_by === officerId);
expectStatus('admin POST lifecycle -> 201', await call('POST', `/assets/${oa.body.data.id}/lifecycle`, { token: A, body: { ...lc, event_type: 'CONSTRUCTION_COMPLETED', title: 'Done' } }), 201);
expectStatus('field GET lifecycle (responsible asset) -> 200', await call('GET', `/assets/${srt.id}/lifecycle`, { token: F }), 200);
expectStatus('field GET lifecycle (same-department, not responsible) -> 403', await call('GET', `/assets/${amd.id}/lifecycle`, { token: F }), 403);
expectStatus('field GET lifecycle (unrelated asset) -> 403', await call('GET', `/assets/${hwy.id}/lifecycle`, { token: F }), 403);

console.log('\n== Activities + assignments');
const acts = async (asset, token) => (await call('GET', `/assets/${asset.id}/activities`, { token })).body.data;
const srtActs = await acts(srt, A);
const assignedAct = srtActs.find((a) => a.title === 'Structural works - floors 3 to 7');
const unassignedAct = srtActs.find((a) => a.title === 'Foundation pile integrity testing'); // accessible asset, not assigned to field@demo
const hwyAct = (await acts(hwy, A))[0]; // asset field user cannot see
const fieldSees = await acts(srt, F);
check('field sees all activities on responsible project', fieldSees.length === 3 && fieldSees.some((a) => a.title === unassignedAct.title));
const mine = await call('GET', '/activities/mine', { token: F });
check('GET /activities/mine returns exactly the 2 assigned', mine.status === 200 && mine.body.data.length === 2 && !!mine.body.data[0].asset_code);
expectStatus('field POST activity -> 403', await call('POST', `/assets/${srt.id}/activities`, { token: F, body: { title: 'x', activity_type: 'OTHER' } }), 403);
const newAct = await call('POST', `/assets/${srt.id}/activities`, { token: O, body: { title: 'Smoke activity', activity_type: 'INSPECTION', created_by: fieldId } });
check('officer POST activity -> 201, created_by = officer (spoof ignored)', newAct.status === 201 && newAct.body.data.created_by === officerId);
expectStatus('field PATCH assigned activity (status+progress) -> 200',
  await call('PATCH', `/activities/${assignedAct.id}`, { token: F, body: { status: 'IN_PROGRESS', progress_percentage: 70 } }), 200);
const done = await call('PATCH', `/activities/${assignedAct.id}`, { token: F, body: { status: 'COMPLETED' } });
check('field completing activity sets progress 100 + completed_at', done.status === 200 && done.body.data.progress_percentage === 100 && !!done.body.data.completed_at);
expectStatus('field PATCH unassigned activity (visible asset) -> 403', await call('PATCH', `/activities/${unassignedAct.id}`, { token: F, body: { progress_percentage: 50 } }), 403, 'FORBIDDEN');
expectStatus('field PATCH unassigned activity (hidden asset) -> 403', await call('PATCH', `/activities/${hwyAct.id}`, { token: F, body: { status: 'COMPLETED' } }), 403);
expectStatus('field PATCH other fields (title) on assigned -> 403', await call('PATCH', `/activities/${assignedAct.id}`, { token: F, body: { title: 'renamed' } }), 403);
expectStatus('officer PATCH any activity -> 200', await call('PATCH', `/activities/${unassignedAct.id}`, { token: O, body: { priority: 'HIGH' } }), 200);
expectStatus('field GET assignments of assigned activity -> 200', await call('GET', `/activities/${assignedAct.id}/assignments`, { token: F }), 200);
expectStatus('field GET assignments of unassigned activity -> 403', await call('GET', `/activities/${unassignedAct.id}/assignments`, { token: F }), 403);
expectStatus('field POST assignment -> 403', await call('POST', `/activities/${unassignedAct.id}/assignments`, { token: F, body: { user_id: fieldId } }), 403);
expectStatus('field DELETE assignment -> 403', await call('DELETE', `/activities/${assignedAct.id}/assignments/${fieldId}`, { token: F }), 403);
const asg = await call('POST', `/activities/${newAct.body.data.id}/assignments`, { token: O, body: { user_id: fieldId, assigned_by: fieldId } });
check('officer POST assignment -> 201, assigned_by = officer', asg.status === 201 && asg.body.data.assigned_by === officerId);
expectStatus('after assignment field can PATCH it', await call('PATCH', `/activities/${newAct.body.data.id}`, { token: F, body: { status: 'IN_PROGRESS' } }), 200);
expectStatus('officer DELETE assignment -> 200', await call('DELETE', `/activities/${newAct.body.data.id}/assignments/${fieldId}`, { token: O }), 200);
expectStatus('after unassignment field PATCH -> 403', await call('PATCH', `/activities/${newAct.body.data.id}`, { token: F, body: { status: 'COMPLETED' } }), 403);
expectStatus('admin POST assignment -> 201', await call('POST', `/activities/${newAct.body.data.id}/assignments`, { token: A, body: { user_id: fieldId } }), 201);

console.log('\n== Inspections');
const insp = { inspection_date: '2026-09-20', inspection_type: 'ROUTINE', condition_status: 'GOOD', findings: 'ok' };
const fi = await call('POST', `/assets/${srt.id}/inspections`, { token: F, body: { ...insp, conducted_by: fieldId } });
check('field POST inspection on responsible asset -> 201 as self', fi.status === 201 && fi.body.data.conducted_by === fieldId);
expectStatus('field inspection as someone else -> 403', await call('POST', `/assets/${srt.id}/inspections`, { token: F, body: { ...insp, conducted_by: officerId } }), 403);
expectStatus('field inspection on same-department asset without responsibility -> 403', await call('POST', `/assets/${amd.id}/inspections`, { token: F, body: insp }), 403);
expectStatus('field inspection on hidden asset -> 403', await call('POST', `/assets/${hwy.id}/inspections`, { token: F, body: insp }), 403);
const oi = await call('POST', `/assets/${hwy.id}/inspections`, { token: O, body: insp });
check('officer POST inspection -> 201, conducted_by defaults to officer', oi.status === 201 && oi.body.data.conducted_by === officerId);
expectStatus('admin POST inspection on behalf of field user -> 201', await call('POST', `/assets/${hwy.id}/inspections`, { token: A, body: { ...insp, conducted_by: fieldId } }), 201);
expectStatus('field GET inspections (assigned asset) -> 200', await call('GET', `/assets/${srt.id}/inspections`, { token: F }), 200);
expectStatus('field GET inspections (hidden asset) -> 403', await call('GET', `/assets/${hwy.id}/inspections`, { token: F }), 403);

console.log('\n== Maintenance');
const mnt = { maintenance_type: 'PREVENTIVE', title: 'Smoke maintenance', status: 'IN_PROGRESS' };
expectStatus('field (CONSTRUCTION responsibility only) POST maintenance -> 403', await call('POST', `/assets/${srt.id}/maintenance`, { token: F, body: mnt }), 403, 'FORBIDDEN');
const fm = await call('POST', `/assets/${amd.id}/maintenance`, { token: F2, body: mnt });
check('field2 (MAINTENANCE responsibility, no activities) POST maintenance -> 201, performed_by = self', fm.status === 201 && fm.body.data.performed_by === field2Id);
expectStatus('field maintenance on same-department asset without responsibility -> 403', await call('POST', `/assets/${amd.id}/maintenance`, { token: F, body: mnt }), 403);
expectStatus('field2 maintenance as someone else -> 403', await call('POST', `/assets/${amd.id}/maintenance`, { token: F2, body: { ...mnt, performed_by: officerId } }), 403);
expectStatus('field2 PATCH own maintenance -> 200', await call('PATCH', `/maintenance/${fm.body.data.id}`, { token: F2, body: { status: 'COMPLETED', completion_date: '2026-09-25' } }), 200);
expectStatus('field2 cannot reassign own maintenance -> 403', await call('PATCH', `/maintenance/${fm.body.data.id}`, { token: F2, body: { performed_by: officerId } }), 403);
const amdMaintList = await call('GET', `/assets/${amd.id}/maintenance`, { token: F2 });
expectStatus('field2 GET maintenance (responsible asset) -> 200', amdMaintList, 200);
expectStatus('field GET maintenance (same-department, not responsible) -> 403', await call('GET', `/assets/${amd.id}/maintenance`, { token: F }), 403);
const amdMaint = amdMaintList.body.data.find((r) => r.id !== fm.body.data.id);
check('seed has an older maintenance record on the asset', !!amdMaint);
expectStatus("field2 PATCH someone else's maintenance -> 403", await call('PATCH', `/maintenance/${amdMaint.id}`, { token: F2, body: { status: 'PLANNED' } }), 403);
expectStatus("officer PATCH anyone's maintenance -> 200", await call('PATCH', `/maintenance/${amdMaint.id}`, { token: O, body: { description: 'reviewed' } }), 200);
expectStatus('officer POST maintenance -> 201', await call('POST', `/assets/${hwy.id}/maintenance`, { token: O, body: mnt }), 201);
expectStatus('admin POST maintenance -> 201', await call('POST', `/assets/${hwy.id}/maintenance`, { token: A, body: mnt }), 201);
expectStatus('GET /assets/:id (admin, counts) -> 200', await call('GET', `/assets/${srt.id}`, { token: A }), 200);

console.log('\n== Field Officer responsibility model (C04.1)');
const FPW = 'Fld-Pass#1';
const xyzEmail = `xyz-${runId}@demo.local`;
const abcEmail = `abc-${runId}@demo.local`;
const mkField = (name, email) => call('POST', '/users', { token: A, body: { name, email, password: FPW, role: 'FIELD_USER', department_id: hfw } });
const xyzC = await mkField('XYZ Field Officer', xyzEmail);
const abcC = await mkField('ABC Field Officer', abcEmail);
check('setup: XYZ and ABC created in the same (Health) department as ABC Hospital', xyzC.status === 201 && abcC.status === 201 && xyzC.body.data.department?.id === hfw && abcC.body.data.department?.id === hfw);
const xyz = xyzC.body.data.id, abc = abcC.body.data.id;
const XYZ = (await login(xyzEmail, FPW)).body.data.token;
const ABC = (await login(abcEmail, FPW)).body.data.token;
const mkHospital = (code, name) => call('POST', '/assets', { token: O, body: { asset_code: `${code}-${runId}`, name, asset_type: 'HOSPITAL', department_id: hfw } });
const hosp = await mkHospital('SMK-ABC-H', 'ABC Hospital');
const otherHosp = await mkHospital('SMK-OTH-H', 'Another Health Dept Hospital');
const hid = hosp.body.data.id, oid = otherHosp.body.data.id;
const R = (assetId) => `/assets/${assetId}/responsibilities`;

console.log(' -- before any assignment: department membership alone grants nothing');
expectStatus('XYZ (same department, not yet assigned) GET ABC Hospital -> 403', await call('GET', `/assets/${hid}`, { token: XYZ }), 403, 'FORBIDDEN');
const xyzList0 = await call('GET', '/assets?limit=100', { token: XYZ });
check('XYZ asset list is empty before assignment', xyzList0.status === 200 && xyzList0.body.data.length === 0 && xyzList0.body.pagination.total === 0);

console.log(' -- Test 7: authorized assignment (+ validation)');
const asg1 = await call('POST', R(hid), { token: O, body: { user_id: xyz, responsibility_type: 'CONSTRUCTION', assigned_by: abc } });
check('T7 officer assigns XYZ -> ABC Hospital -> CONSTRUCTION -> 201, assigned_by = officer (spoof ignored)',
  asg1.status === 201 && asg1.body.data.user_id === xyz && asg1.body.data.asset_id === hid && asg1.body.data.responsibility_type === 'CONSTRUCTION' && asg1.body.data.assigned_by === officerId && !!asg1.body.data.assigned_at);
const adminAsg = await call('POST', R(oid), { token: A, body: { user_id: fieldId, responsibility_type: 'MAINTENANCE' } });
check('T7 admin assigns a field officer -> 201', adminAsg.status === 201 && adminAsg.body.data.assigned_by === jwt.decode(A).sub);
expectStatus('admin DELETE that responsibility -> 200', await call('DELETE', `${R(oid)}/${fieldId}`, { token: A }), 200);
expectStatus('duplicate (asset, user, type) -> 409 DUPLICATE_RESPONSIBILITY', await call('POST', R(hid), { token: O, body: { user_id: xyz, responsibility_type: 'CONSTRUCTION' } }), 409, 'DUPLICATE_RESPONSIBILITY');
expectStatus('invalid responsibility_type -> 400', await call('POST', R(hid), { token: O, body: { user_id: abc, responsibility_type: 'SUPERVISION' } }), 400);
expectStatus('missing user_id -> 400', await call('POST', R(hid), { token: O, body: { responsibility_type: 'MAINTENANCE' } }), 400);
expectStatus('assigning a non-field user (officer) -> 400 INVALID_ASSIGNEE', await call('POST', R(hid), { token: O, body: { user_id: officerId, responsibility_type: 'MAINTENANCE' } }), 400, 'INVALID_ASSIGNEE');
const inactiveId = ul.body.data.find((u) => u.email === 'inactive@demo.local').id;
expectStatus('assigning an inactive user -> 400 INACTIVE_USER', await call('POST', R(hid), { token: O, body: { user_id: inactiveId, responsibility_type: 'MAINTENANCE' } }), 400, 'INACTIVE_USER');
expectStatus('assigning an unknown user -> 400 INVALID_REFERENCE', await call('POST', R(hid), { token: O, body: { user_id: '00000000-0000-0000-0000-000000000000', responsibility_type: 'MAINTENANCE' } }), 400, 'INVALID_REFERENCE');
expectStatus('assignment on unknown asset -> 404', await call('POST', R('00000000-0000-0000-0000-000000000000'), { token: O, body: { user_id: abc, responsibility_type: 'MAINTENANCE' } }), 404);
expectStatus('assignment on malformed asset id -> 400', await call('POST', R('nope'), { token: O, body: { user_id: abc, responsibility_type: 'MAINTENANCE' } }), 400);
expectStatus('unauthenticated POST responsibilities -> 401', await call('POST', R(hid), { body: { user_id: abc, responsibility_type: 'MAINTENANCE' } }), 401);

console.log(' -- Test 1: responsible Field Officer');
expectStatus('T1 XYZ GET ABC Hospital -> 200', await call('GET', `/assets/${hid}`, { token: XYZ }), 200);
const xyzList = await call('GET', '/assets?limit=100', { token: XYZ });
check('T1 XYZ asset list = exactly ABC Hospital', xyzList.status === 200 && xyzList.body.data.length === 1 && xyzList.body.data[0].id === hid && xyzList.body.pagination.total === 1);
expectStatus('T1 XYZ GET lifecycle history -> 200', await call('GET', `/assets/${hid}/lifecycle`, { token: XYZ }), 200);
const xyzResp = await call('GET', R(hid), { token: XYZ });
check('XYZ can view who is responsible (read-only)', xyzResp.status === 200 && xyzResp.body.data.length === 1 && xyzResp.body.data[0].user_email === xyzEmail);
expectStatus('XYZ cannot access an unrelated asset in the same department -> 403', await call('GET', `/assets/${oid}`, { token: XYZ }), 403);
expectStatus('XYZ cannot access an asset in another department -> 403', await call('GET', `/assets/${hwy.id}`, { token: XYZ }), 403);

console.log(' -- Tests 2 + 3: not responsible (same department) -> denied everywhere');
for (const [label, m, path, body] of [
  ['asset', 'GET', `/assets/${hid}`], ['lifecycle', 'GET', `/assets/${hid}/lifecycle`], ['activities', 'GET', `/assets/${hid}/activities`],
  ['inspections', 'GET', `/assets/${hid}/inspections`], ['maintenance', 'GET', `/assets/${hid}/maintenance`], ['responsibilities', 'GET', R(hid)],
  ['lifecycle POST', 'POST', `/assets/${hid}/lifecycle`, { event_type: 'CONSTRUCTION_PROGRESS', event_date: '2026-09-20', title: 'x' }],
  ['inspection POST', 'POST', `/assets/${hid}/inspections`, insp],
  ['maintenance POST', 'POST', `/assets/${hid}/maintenance`, mnt],
]) expectStatus(`T2/T3 ABC (same dept, no responsibility) ${m} ${label} -> 403`, await call(m, path, { token: ABC, body }), 403, 'FORBIDDEN');
const abcList = await call('GET', '/assets?limit=100', { token: ABC });
check('T2/T3 ABC asset list is empty (not the whole department)', abcList.status === 200 && abcList.body.data.length === 0);

console.log(' -- Test 4: responsible officer with NO activity assignment does routine updates');
const xyzMine = await call('GET', '/activities/mine', { token: XYZ });
check('T4 precondition: XYZ has no activity assigned', xyzMine.status === 200 && xyzMine.body.data.length === 0);
const started = await call('POST', `/assets/${hid}/lifecycle`, { token: XYZ, body: { event_type: 'CONSTRUCTION_STARTED', event_date: '2026-09-01', title: 'Site handed over' } });
check('T4 XYZ records CONSTRUCTION_STARTED -> 201, asset moves to UNDER_CONSTRUCTION', started.status === 201 && started.body.data.asset.lifecycle_status === 'UNDER_CONSTRUCTION' && started.body.data.event.recorded_by === xyz);
const prog = await call('POST', `/assets/${hid}/lifecycle`, { token: XYZ, body: { event_type: 'CONSTRUCTION_PROGRESS', event_date: '2026-09-20', title: 'Progress 40%', progress_percentage: 40, recorded_by: abc } });
check('T4 XYZ routine progress update (40%) -> 201, recorded_by = XYZ (spoof ignored)', prog.status === 201 && prog.body.data.event.progress_percentage === 40 && prog.body.data.event.recorded_by === xyz);
expectStatus('T4 XYZ submits an inspection -> 201', await call('POST', `/assets/${hid}/inspections`, { token: XYZ, body: insp }), 201);
const tl = await call('GET', `/assets/${hid}/lifecycle`, { token: O });
check('history shows the officer-recorded events', tl.body.data.some((e) => e.event_type === 'CONSTRUCTION_PROGRESS' && e.recorded_by === xyz));
for (const t of ['REHABILITATION', 'DECOMMISSIONED', 'END_OF_LIFE_ASSESSMENT', 'PLANNED', 'MAINTENANCE_STARTED'])
  expectStatus(`XYZ (CONSTRUCTION) cannot record ${t} -> 403`, await call('POST', `/assets/${hid}/lifecycle`, { token: XYZ, body: { event_type: t, event_date: '2026-09-21', title: 'x' } }), 403, 'FORBIDDEN');
expectStatus('XYZ (CONSTRUCTION only) cannot submit maintenance -> 403', await call('POST', `/assets/${hid}/maintenance`, { token: XYZ, body: mnt }), 403, 'FORBIDDEN');
expectStatus('XYZ cannot PATCH the asset -> 403', await call('PATCH', `/assets/${hid}`, { token: XYZ, body: { name: 'Hacked' } }), 403);
expectStatus('XYZ cannot create activities -> 403', await call('POST', `/assets/${hid}/activities`, { token: XYZ, body: { title: 'x', activity_type: 'OTHER' } }), 403);
expectStatus('XYZ cannot create assets -> 403', await call('POST', '/assets', { token: XYZ, body: newAsset('SMK-X-1') }), 403);
expectStatus('XYZ cannot list/manage users -> 403', await call('GET', '/users', { token: XYZ }), 403);

console.log(' -- Tests 5 + 6: field users cannot assign responsibility');
expectStatus('T5 XYZ self-assign (MAINTENANCE) on own asset -> 403', await call('POST', R(hid), { token: XYZ, body: { user_id: xyz, responsibility_type: 'MAINTENANCE' } }), 403);
expectStatus('T5 XYZ self-assign on an asset they are not responsible for -> 403', await call('POST', R(oid), { token: XYZ, body: { user_id: xyz, responsibility_type: 'CONSTRUCTION' } }), 403);
expectStatus('T5 ABC self-assign on ABC Hospital -> 403', await call('POST', R(hid), { token: ABC, body: { user_id: abc, responsibility_type: 'CONSTRUCTION' } }), 403);
expectStatus('T6 XYZ assigns another field user (ABC) to own asset -> 403', await call('POST', R(hid), { token: XYZ, body: { user_id: abc, responsibility_type: 'CONSTRUCTION' } }), 403);
expectStatus('T6 field (SRT-002 officer) assigns field2 on own asset -> 403', await call('POST', R(srt.id), { token: F, body: { user_id: field2Id, responsibility_type: 'CONSTRUCTION' } }), 403);
expectStatus('field cannot remove own responsibility -> 403', await call('DELETE', `${R(hid)}/${xyz}`, { token: XYZ }), 403);
expectStatus("field cannot remove someone else's responsibility -> 403", await call('DELETE', `${R(srt.id)}/${fieldId}`, { token: F2 }), 403);
expectStatus('ABC still cannot access ABC Hospital after the attempts -> 403', await call('GET', `/assets/${hid}`, { token: ABC }), 403);
expectStatus('XYZ still cannot submit maintenance after self-assign attempt -> 403', await call('POST', `/assets/${hid}/maintenance`, { token: XYZ, body: mnt }), 403);
const srtResp = await call('GET', R(srt.id), { token: O });
check('SRT-002 responsibility of field@demo untouched', srtResp.status === 200 && srtResp.body.data.some((r) => r.user_id === fieldId && r.responsibility_type === 'CONSTRUCTION'));

console.log(' -- CONSTRUCTION + MAINTENANCE capacities, removal');
const comp = await call('POST', `/assets/${hid}/lifecycle`, { token: XYZ, body: { event_type: 'CONSTRUCTION_COMPLETED', event_date: '2026-09-21', title: 'Hospital construction complete' } });
check('XYZ completes construction -> moves to OPERATIONAL', comp.status === 201 && comp.body.data.asset.lifecycle_status === 'OPERATIONAL');
expectStatus('officer also assigns XYZ MAINTENANCE on the same asset -> 201', await call('POST', R(hid), { token: O, body: { user_id: xyz, responsibility_type: 'MAINTENANCE' } }), 201);
const xm = await call('POST', `/assets/${hid}/maintenance`, { token: XYZ, body: mnt });
check('XYZ (now MAINTENANCE too) POST maintenance -> 201, performed_by = XYZ', xm.status === 201 && xm.body.data.performed_by === xyz);
const ms = await call('POST', `/assets/${hid}/lifecycle`, { token: XYZ, body: { event_type: 'MAINTENANCE_STARTED', event_date: '2026-09-22', title: 'Maintenance' } });
check('XYZ records MAINTENANCE_STARTED -> 201, asset UNDER_MAINTENANCE', ms.status === 201 && ms.body.data.asset.lifecycle_status === 'UNDER_MAINTENANCE');
expectStatus('XYZ PATCH own maintenance record -> 200', await call('PATCH', `/maintenance/${xm.body.data.id}`, { token: XYZ, body: { status: 'COMPLETED' } }), 200);
expectStatus('invalid responsibility_type on DELETE -> 400', await call('DELETE', `${R(hid)}/${xyz}?responsibility_type=BOGUS`, { token: O }), 400);
const delM = await call('DELETE', `${R(hid)}/${xyz}?responsibility_type=MAINTENANCE`, { token: O });
check('officer removes only the MAINTENANCE responsibility -> 200', delM.status === 200 && delM.body.data.removed.join() === 'MAINTENANCE');
expectStatus('XYZ can no longer submit maintenance -> 403', await call('POST', `/assets/${hid}/maintenance`, { token: XYZ, body: mnt }), 403);
expectStatus('XYZ can no longer PATCH own old maintenance record -> 403', await call('PATCH', `/maintenance/${xm.body.data.id}`, { token: XYZ, body: { status: 'IN_PROGRESS' } }), 403);
expectStatus('XYZ keeps asset access via CONSTRUCTION -> 200', await call('GET', `/assets/${hid}`, { token: XYZ }), 200);
expectStatus('DELETE non-existent responsibility -> 404', await call('DELETE', `${R(hid)}/${abc}`, { token: O }), 404);
const delAll = await call('DELETE', `${R(hid)}/${xyz}`, { token: O });
check('officer removes all remaining responsibilities of XYZ -> 200', delAll.status === 200 && delAll.body.data.removed.join() === 'CONSTRUCTION');
expectStatus('XYZ loses access immediately -> 403', await call('GET', `/assets/${hid}`, { token: XYZ }), 403);
expectStatus('history is retained after unassignment (officer view) -> 200', await call('GET', `/assets/${hid}/lifecycle`, { token: O }), 200);

console.log(' -- Test 8: activity assignments stay independent of responsibility');
const hAct = await call('POST', `/assets/${hid}/activities`, { token: O, body: { title: 'Site progress update', activity_type: 'CONSTRUCTION' } });
expectStatus('officer creates activity on ABC Hospital -> 201', hAct, 201);
expectStatus('officer assigns ABC (no responsibility) to the activity -> 201', await call('POST', `/activities/${hAct.body.data.id}/assignments`, { token: O, body: { user_id: abc } }), 201);
expectStatus('T8 ABC PATCH own assigned activity -> 200', await call('PATCH', `/activities/${hAct.body.data.id}`, { token: ABC, body: { status: 'IN_PROGRESS', progress_percentage: 30 } }), 200);
const abcMine = await call('GET', '/activities/mine', { token: ABC });
check('T8 GET /activities/mine lists the assigned activity', abcMine.status === 200 && abcMine.body.data.length === 1);
expectStatus('T8 activity assignment does NOT grant asset access (ABC GET asset -> 403)', await call('GET', `/assets/${hid}`, { token: ABC }), 403);
expectStatus('officer re-assigns XYZ CONSTRUCTION -> 201', await call('POST', R(hid), { token: O, body: { user_id: xyz, responsibility_type: 'CONSTRUCTION' } }), 201);
expectStatus('T8 responsible XYZ is NOT assigned to the activity -> PATCH 403', await call('PATCH', `/activities/${hAct.body.data.id}`, { token: XYZ, body: { status: 'COMPLETED' } }), 403);
expectStatus('T8 responsible XYZ still does routine updates without any activity -> 201', await call('POST', `/assets/${hid}/lifecycle`, { token: XYZ, body: { event_type: 'OTHER', event_date: '2026-09-25', title: 'Routine site observation' } }), 201);
expectStatus('officer unassigns ABC from the activity -> 200', await call('DELETE', `/activities/${hAct.body.data.id}/assignments/${abc}`, { token: O }), 200);
expectStatus('after unassignment ABC PATCH -> 403', await call('PATCH', `/activities/${hAct.body.data.id}`, { token: ABC, body: { status: 'COMPLETED' } }), 403);

console.log('\n== CP06: Lifecycle State Machine & Workflow Validation');
// Create a dedicated fresh test asset in PLANNED state
const testAssetRes = await call('POST', '/assets', {
  token: O,
  body: newAsset('CP06-TEST-ASSET'),
});
check('Officer creates CP06 test asset in PLANNED state', testAssetRes.status === 201 && testAssetRes.body.data.lifecycle_status === 'PLANNED');
const testAssetId = testAssetRes.body?.data?.id;

if (testAssetId) {
  // 1. Invalid transitions from PLANNED
  expectStatus('PLANNED -> DECOMMISSIONED rejected -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/lifecycle`, { token: O, body: { event_type: 'DECOMMISSIONED', event_date: '2026-09-28', title: 'Invalid Decom' } }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  expectStatus('PLANNED -> CONSTRUCTION_COMPLETED rejected -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/lifecycle`, { token: O, body: { event_type: 'CONSTRUCTION_COMPLETED', event_date: '2026-09-28', title: 'Invalid Complete' } }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  expectStatus('PLANNED -> CONSTRUCTION_PROGRESS rejected -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/lifecycle`, { token: O, body: { event_type: 'CONSTRUCTION_PROGRESS', event_date: '2026-09-28', title: 'Invalid Progress', progress_percentage: 20 } }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  expectStatus('PLANNED -> MAINTENANCE_STARTED rejected -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/lifecycle`, { token: O, body: { event_type: 'MAINTENANCE_STARTED', event_date: '2026-09-28', title: 'Invalid Maint' } }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  expectStatus('PLANNED -> POST inspection rejected -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/inspections`, { token: O, body: insp }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  expectStatus('PLANNED -> POST maintenance rejected -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/maintenance`, { token: O, body: mnt }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  // 2. Transition PLANNED -> UNDER_CONSTRUCTION
  const startConst = await call('POST', `/assets/${testAssetId}/lifecycle`, {
    token: O,
    body: { event_type: 'CONSTRUCTION_STARTED', event_date: '2026-09-28', title: 'Construction Groundbreaking' },
  });
  check('PLANNED -> CONSTRUCTION_STARTED succeeds and updates status to UNDER_CONSTRUCTION',
    startConst.status === 201 && startConst.body.data.asset.lifecycle_status === 'UNDER_CONSTRUCTION');

  // 3. UNDER_CONSTRUCTION validations
  expectStatus('UNDER_CONSTRUCTION -> MAINTENANCE_STARTED rejected -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/lifecycle`, { token: O, body: { event_type: 'MAINTENANCE_STARTED', event_date: '2026-09-28', title: 'Early Maint' } }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  expectStatus('UNDER_CONSTRUCTION -> POST maintenance rejected -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/maintenance`, { token: O, body: mnt }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  const constProg = await call('POST', `/assets/${testAssetId}/lifecycle`, {
    token: O,
    body: { event_type: 'CONSTRUCTION_PROGRESS', event_date: '2026-09-28', title: 'Pillars Complete', progress_percentage: 65 },
  });
  check('UNDER_CONSTRUCTION allows CONSTRUCTION_PROGRESS update', constProg.status === 201 && constProg.body.data.event.progress_percentage === 65);

  const constInsp = await call('POST', `/assets/${testAssetId}/inspections`, { token: O, body: insp });
  check('UNDER_CONSTRUCTION allows condition inspection', constInsp.status === 201 && constInsp.body.data.condition_status === 'GOOD');

  // Complete construction -> OPERATIONAL
  const completeConst = await call('POST', `/assets/${testAssetId}/lifecycle`, {
    token: O,
    body: { event_type: 'CONSTRUCTION_COMPLETED', event_date: '2026-09-28', title: 'Inauguration' },
  });
  check('CONSTRUCTION_COMPLETED transitions to OPERATIONAL with 100% progress',
    completeConst.status === 201 && completeConst.body.data.asset.lifecycle_status === 'OPERATIONAL' && completeConst.body.data.event.progress_percentage === 100);

  // 4. OPERATIONAL validations
  expectStatus('OPERATIONAL -> CONSTRUCTION_PROGRESS rejected -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/lifecycle`, { token: O, body: { event_type: 'CONSTRUCTION_PROGRESS', event_date: '2026-09-28', title: 'Post-complete progress', progress_percentage: 70 } }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  const opMaint = await call('POST', `/assets/${testAssetId}/maintenance`, { token: O, body: mnt });
  check('OPERATIONAL allows POST maintenance record', opMaint.status === 201 && opMaint.body.data.status === 'IN_PROGRESS');

  const startMaint = await call('POST', `/assets/${testAssetId}/lifecycle`, {
    token: O,
    body: { event_type: 'MAINTENANCE_STARTED', event_date: '2026-09-28', title: 'HVAC repair work' },
  });
  check('MAINTENANCE_STARTED transitions asset to UNDER_MAINTENANCE',
    startMaint.status === 201 && startMaint.body.data.asset.lifecycle_status === 'UNDER_MAINTENANCE');

  // 5. UNDER_MAINTENANCE validations
  expectStatus('UNDER_MAINTENANCE -> MAINTENANCE_STARTED duplicate rejected -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/lifecycle`, { token: O, body: { event_type: 'MAINTENANCE_STARTED', event_date: '2026-09-28', title: 'Duplicate Start' } }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  const endMaint = await call('POST', `/assets/${testAssetId}/lifecycle`, {
    token: O,
    body: { event_type: 'MAINTENANCE_COMPLETED', event_date: '2026-09-28', title: 'HVAC repair completed' },
  });
  check('MAINTENANCE_COMPLETED transitions asset back to OPERATIONAL',
    endMaint.status === 201 && endMaint.body.data.asset.lifecycle_status === 'OPERATIONAL');

  // 6. END_OF_LIFE and DECOMMISSIONED
  const eolRes = await call('POST', `/assets/${testAssetId}/lifecycle`, {
    token: O,
    body: { event_type: 'END_OF_LIFE_ASSESSMENT', event_date: '2026-09-28', title: 'Structural fatigue reached' },
  });
  check('END_OF_LIFE_ASSESSMENT transitions asset to END_OF_LIFE',
    eolRes.status === 201 && eolRes.body.data.asset.lifecycle_status === 'END_OF_LIFE');

  const decomRes = await call('POST', `/assets/${testAssetId}/lifecycle`, {
    token: O,
    body: { event_type: 'DECOMMISSIONED', event_date: '2026-09-28', title: 'Facility closed and decommissioned' },
  });
  check('DECOMMISSIONED transitions asset to DECOMMISSIONED',
    decomRes.status === 201 && decomRes.body.data.asset.lifecycle_status === 'DECOMMISSIONED');

  // 7. Terminal DECOMMISSIONED checks
  expectStatus('DECOMMISSIONED asset rejects new lifecycle events -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/lifecycle`, { token: O, body: { event_type: 'OTHER', event_date: '2026-09-28', title: 'Late event' } }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  expectStatus('DECOMMISSIONED asset rejects inspections -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/inspections`, { token: O, body: insp }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  expectStatus('DECOMMISSIONED asset rejects maintenance -> 400 INVALID_LIFECYCLE_TRANSITION',
    await call('POST', `/assets/${testAssetId}/maintenance`, { token: O, body: mnt }),
    400, 'INVALID_LIFECYCLE_TRANSITION');

  // 8. Full timeline retention check
  const fullTimeline = await call('GET', `/assets/${testAssetId}/lifecycle`, { token: O });
  check('Full chronological lifecycle history retained (>= 6 events)',
    fullTimeline.status === 200 && fullTimeline.body.data.length >= 6);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }

