// Load environment variables before config evaluation
// Priority: .env.local (secrets) > .env (defaults)
import 'dotenv/config';

import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),

  // Database connection for Prisma CLI operations (migrate, db pull, etc.)
  datasource: {
    url: env('DATABASE_URL'),
  },

  // Seed script for development data
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
