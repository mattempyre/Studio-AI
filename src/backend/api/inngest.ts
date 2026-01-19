import { serve } from 'inngest/express';
import { inngest, functions } from '../inngest/index.js';

/**
 * Inngest serve handler for Express
 * This endpoint handles:
 * - GET: Returns function metadata and debug page in development
 * - POST: Invokes functions when triggered by events
 * - PUT: Registers functions with the Inngest server
 */

// In development with Docker, Inngest runs in a container and needs to reach
// the Express server on the host. We use host.docker.internal for this.
const isDev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3001;
const serveHost = isDev ? `http://host.docker.internal:${port}` : undefined;

export const inngestHandler = serve({
  client: inngest,
  functions,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  serveHost,
});
