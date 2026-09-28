import { Router } from 'express';
import { AppError } from '../../utils/AppError';
import { hashPassword, ROLE_VALUES } from '../../utils/auth';
import { requireEnum, requireString, requireUUID } from '../../utils/validation';
import { currentUser, requireRole } from '../../middleware/auth';
import {
  createUser,
  departmentExists,
  emailInUse,
  getPublicUserById,
  listUsers,
  updateUser,
} from '../../repositories/users.repository';
import type { UserUpdate } from '../../repositories/users.repository';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validEmail(value: unknown): string {
  const email = requireString(value, 'email', 254).toLowerCase();
  if (!EMAIL_RE.test(email)) throw AppError.badRequest('email must be a valid email address');
  return email;
}

// bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than truncated.
function validPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8) {
    throw AppError.badRequest('password must be at least 8 characters');
  }
  if (Buffer.byteLength(value, 'utf8') > 72) throw AppError.badRequest('password must be at most 72 bytes');
  return value;
}

async function validDepartment(value: unknown): Promise<string> {
  const id = requireUUID(value, 'department_id');
  if (!(await departmentExists(id))) {
    throw AppError.badRequest('department_id does not reference an existing department', 'INVALID_REFERENCE');
  }
  return id;
}

// GET /api/users
//  - ADMIN: full list, filterable (?role=&is_active=&department_id=&search=)
//  - GOVERNMENT_OFFICER: read-only list of active FIELD_USERs (needed to assign work)
router.get('/', requireRole('ADMIN', 'GOVERNMENT_OFFICER'), async (req, res) => {
  const user = currentUser(req);
  if (user.role === 'GOVERNMENT_OFFICER') {
    res.json({ data: await listUsers({ role: 'FIELD_USER', isActive: true }) });
    return;
  }

  const q = req.query;
  const role = typeof q.role === 'string' && q.role ? requireEnum(q.role, 'role', ROLE_VALUES) : undefined;
  const isActive =
    q.is_active === 'true' ? true : q.is_active === 'false' ? false : undefined;
  const departmentId =
    typeof q.department_id === 'string' && q.department_id ? requireUUID(q.department_id, 'department_id') : undefined;
  const search = typeof q.search === 'string' && q.search.trim() ? q.search.trim() : undefined;

  res.json({ data: await listUsers({ role, isActive, departmentId, search }) });
});

// GET /api/users/:id  (admin only)
router.get('/:id', requireRole('ADMIN'), async (req, res) => {
  const user = await getPublicUserById(requireUUID(req.params.id, 'id'));
  if (!user) throw AppError.notFound('User');
  res.json({ data: user });
});

// POST /api/users  (admin only)
router.post('/', requireRole('ADMIN'), async (req, res) => {
  const body = req.body ?? {};
  const name = requireString(body.name, 'name', 200);
  const email = validEmail(body.email);
  const password = validPassword(body.password);
  const role = requireEnum(body.role, 'role', ROLE_VALUES);
  const department_id = body.department_id ? await validDepartment(body.department_id) : null;
  const is_active = body.is_active === undefined ? true : body.is_active === true;
  if (body.is_active !== undefined && typeof body.is_active !== 'boolean') {
    throw AppError.badRequest('is_active must be a boolean');
  }
  if (await emailInUse(email)) throw AppError.conflict(`email '${email}' is already in use`, 'EMAIL_IN_USE');

  const created = await createUser({
    name,
    email,
    password_hash: await hashPassword(password),
    role,
    department_id,
    is_active,
  });
  res.status(201).json({ data: created });
});

// PATCH /api/users/:id  (admin only) - profile, role, department, active flag, password reset
router.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const admin = currentUser(req);
  const id = requireUUID(req.params.id, 'id');
  const existing = await getPublicUserById(id);
  if (!existing) throw AppError.notFound('User');

  const body = req.body ?? {};
  const fields: UserUpdate = {};
  if (body.name !== undefined) fields.name = requireString(body.name, 'name', 200);
  if (body.email !== undefined) {
    const email = validEmail(body.email);
    if (await emailInUse(email, id)) throw AppError.conflict(`email '${email}' is already in use`, 'EMAIL_IN_USE');
    fields.email = email;
  }
  if (body.password !== undefined) fields.password_hash = await hashPassword(validPassword(body.password));
  if (body.role !== undefined) fields.role = requireEnum(body.role, 'role', ROLE_VALUES);
  if (body.department_id !== undefined) {
    fields.department_id = body.department_id === null || body.department_id === '' ? null : await validDepartment(body.department_id);
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') throw AppError.badRequest('is_active must be a boolean');
    fields.is_active = body.is_active;
  }

  if (Object.keys(fields).length === 0) throw AppError.badRequest('No editable fields were provided');

  // Guard against an admin locking themselves out of the admin console.
  if (id === admin.id && (fields.is_active === false || (fields.role && fields.role !== 'ADMIN'))) {
    throw AppError.badRequest('You cannot deactivate or demote your own account', 'SELF_LOCKOUT');
  }

  res.json({ data: await updateUser(id, fields) });
});

export default router;
