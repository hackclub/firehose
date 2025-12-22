const { getPrisma } = require("./prismaConnector");

async function autoUnshush(app) {
  const prisma = getPrisma();

  async function checkExpiredShushes() {
    try {
      // Find all bans with expiration times that have passed
      const expiredBans = await prisma.bans.findMany({
        where: {
          time: {
            lte: new Date(),
            not: null,
          },
        },
      });

      for (const ban of expiredBans) {
        try {
          // Post message to mirror channel
          await app.client.chat.postMessage({
            channel: process.env.MIRRORCHANNEL,
            text: `<@${ban.user}> was automatically unshushed (shush expired)`,
            mrkdwn: true,
          });

          // Delete the ban from database
          await prisma.bans.delete({
            where: { id: ban.id },
          });

          // Notify the user
          await app.client.chat.postMessage({
            channel: ban.user,
            text: `You have been automatically unshushed. Your temporary ban has expired.`,
          });
        } catch (e) {
          console.error(`Error unshushing user ${ban.user}:`, e);
        }
      }
    } catch (e) {
      console.error("Error checking expired shushes:", e);
    }
  }

  // Check every minute for expired shushes
  setInterval(checkExpiredShushes, 1000 * 60);

  // Run once immediately on startup
  checkExpiredShushes();
}

module.exports = autoUnshush;
