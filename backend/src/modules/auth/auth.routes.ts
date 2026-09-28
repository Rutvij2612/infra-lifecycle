import { Router } from 'express';
import { AppError } from '../../utils/AppError';
import { signToken, verifyPassword } from '../../utils/auth';
import { currentUser, requireAuth } from '../../middleware/auth';
import { getPublicUserById, getUserAuthByEmail } from '../../repositories/users.repository';

const router = Router();

const INVALID_CREDENTIALS = 'Invalid email or password';

// POST /api/auth/login  (public)
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw AppError.badRequest('email and password are required');
  }

  const user = await getUserAuthByEmail(email.trim());
  // Always run the bcrypt compare (dummy hash when the user is unknown) and return one
  // generic error for: unknown email, wrong password, no password set, inactive account.
  const passwordOk = await verifyPassword(password, user?.password_hash ?? null);
  if (!user || !passwordOk || !user.is_active) {
    throw AppError.unauthorized(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  }

  const profile = await getPublicUserById(user.id);
  res.json({ data: { token: signToken(user), user: profile } });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const profile = await getPublicUserById(currentUser(req).id);
  if (!profile) throw AppError.unauthorized('Account not found', 'INVALID_TOKEN');
  res.json({ data: profile });
});

export default router;
