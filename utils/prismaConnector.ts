import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
    if (!prismaClient) prismaClient = new PrismaClient();
    return prismaClient;
}
