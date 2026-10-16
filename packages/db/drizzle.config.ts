import { defineConfig } from 'drizzle-kit';

// `pnpm generate` writes a draft into .drizzle (git-ignored). The reversible migrations in
// ./migrations (NNNN_name.up.sql and NNNN_name.down.sql) are curated from that draft. Never edit
// a migration that has been applied; add a new pair instead.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './.drizzle',
});
