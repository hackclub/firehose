const { PrismaClient } = require("@prisma/client");
let prismaClient;

function getPrisma() {
  if (!prismaClient) prismaClient = new PrismaClient();
  return prismaClient;
}

module.exports = { getPrisma };
