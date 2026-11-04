import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

// Migrações:
// - Produção (VPS): motor nativo do Prisma (padrão).
// - Ambientes sem acesso a binaries.prisma.sh: PRISMA_MIGRATE_ADAPTER=1 usa o motor WASM via driver adapter.
const usarAdapter = process.env.PRISMA_MIGRATE_ADAPTER === '1';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: { seed: 'ts-node prisma/seed.ts' },
  ...(usarAdapter
    ? {
        experimental: { adapter: true },
        engine: 'js' as const,
        async adapter() {
          return new PrismaPg({ connectionString: process.env.DATABASE_URL! });
        },
      }
    : {}),
});
