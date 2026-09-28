import app from './app';
import { env } from './config/env';

if (env.isProduction && env.jwtSecret.length < 32) {
  console.error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
  process.exit(1);
}

app.listen(env.port, () => {
  console.log(`API running on http://localhost:${env.port} (${env.nodeEnv})`);
  if (!env.jwtSecret) {
    console.warn('JWT_SECRET is not set - login and all protected endpoints will fail.');
  }
  if (!env.databaseUrl) {
    console.warn('DATABASE_URL is not set - database features are disabled.');
  }
});
