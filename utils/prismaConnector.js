const { PrismaClient } = require('@prisma/client');
/** @type {PrismaClient | undefined} */
let prismaClient;

function getPrisma() {
    if (!prismaClient) prismaClient = new PrismaClient();
    return prismaClient;
}

module.exports = { getPrisma };
