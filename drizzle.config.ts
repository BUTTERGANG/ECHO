import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit config. We use the `expo` driver so `drizzle-kit generate`
 * emits migrations that the `drizzle-orm/expo-sqlite` migrator can run on
 * device/web at runtime (there is no local .db file to point at).
 */
export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
