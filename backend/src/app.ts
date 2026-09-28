import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import routes from './routes';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        env.corsOrigins.includes('*') ||
        env.corsOrigins.includes(origin) ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  }),
);
app.use(express.json());

// Mount API routes at /api (standard) and / (fallback for serverless rewrites)
app.use('/api', routes);
app.use('/', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
