import { Prisma, PrismaClient } from '../node_modules/.prisma/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

let prismaClient: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
    if (!prismaClient) {
        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        prismaClient = new PrismaClient({ adapter });
    }
    return prismaClient;
}

export const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError;
