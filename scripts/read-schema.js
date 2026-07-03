const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  try {
    const rows = await prisma.$queryRawUnsafe("SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('Conversation', 'Message', '_UserConversations')");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
