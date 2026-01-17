import { serve } from 'inngest/express';
import { inngest, functions } from '../inngest/index.js';

/**
 * Inngest serve handler for Express
 * This endpoint handles:
 * - GET: Returns function metadata and debug page in development
 * - POST: Invokes functions when triggered by events
 * - PUT: Registers functions with the Inngest server
 */
export const inngestHandler = serve({
  client: inngest,
  functions,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
