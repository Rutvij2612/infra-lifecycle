import type { IncomingMessage, ServerResponse } from 'http';
import app from '../backend/src/app';

// Vercel Serverless Function entry point wrapping the Express application
export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req, res);
}
