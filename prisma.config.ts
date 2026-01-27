import path from 'node:path';
import { defineConfig } from 'prisma/config';

try {
    process.loadEnvFile();
} catch (e) {
    // Ignore error if no .env file is found
}
export default defineConfig({
    schema: path.join(import.meta.dirname, 'prisma', 'schema.prisma'),
    datasource: {
        url: process.env.DATABASE_URL,
        shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
    },
});
