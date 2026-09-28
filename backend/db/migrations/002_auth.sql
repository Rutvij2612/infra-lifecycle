-- 002_auth.sql
-- Authentication support. Reuses the existing users table, user_role enum
-- (ADMIN, GOVERNMENT_OFFICER, FIELD_USER), is_active flag and department_id.
-- Only the password hash is new. It is nullable so existing rows survive the
-- migration; a user with no hash simply cannot log in until a password is set.
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Case-insensitive email uniqueness (the API lower-cases emails on write and login).
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));
