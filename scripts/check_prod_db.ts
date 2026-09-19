// Diagnostic: verify the production Turso DB is reachable, the schema has
// the newest columns, and the exact queries the homepage/API routes run
// don't throw. Read-only — safe to run against production.
import prisma from "../lib/prisma";

async function main() {
  console.log("TURSO_DATABASE_URL set:", !!process.env.TURSO_DATABASE_URL);
  console.log("TURSO_AUTH_TOKEN set:", !!process.env.TURSO_AUTH_TOKEN);

  try {
    const jobs = await prisma.job.findMany({ take: 3, include: { owner: { select: { id: true, name: true, avatarUrl: true } } } });
    console.log("OK prisma.job.findMany ->", jobs.length, "rows");
  } catch (e: any) {
    console.error("FAIL prisma.job.findMany:", e.message);
  }

  try {
    const techs = await prisma.technicianProfile.findMany({ take: 3, include: { user: { select: { id: true, name: true, avatarUrl: true, phone: true } } } });
    console.log("OK prisma.technicianProfile.findMany ->", techs.length, "rows");
  } catch (e: any) {
    console.error("FAIL prisma.technicianProfile.findMany:", e.message);
  }

  try {
    const users = await prisma.user.findMany({
      take: 1,
      select: { id: true, diagnosedPains: true },
    });
    console.log("OK User.diagnosedPains column readable ->", users.length, "rows");
  } catch (e: any) {
    console.error("FAIL User.diagnosedPains column:", e.message);
  }

  try {
    const tp = await prisma.technicianProfile.findMany({
      take: 1,
      select: { id: true, desiredSalaryType: true, desiredSalaryAmount: true, desiredBenefits: true },
    });
    console.log("OK TechnicianProfile desired* columns readable ->", tp.length, "rows");
  } catch (e: any) {
    console.error("FAIL TechnicianProfile desired* columns:", e.message);
  }

  try {
    const convos = await prisma.conversation.findMany({ take: 1 });
    console.log("OK prisma.conversation.findMany ->", convos.length, "rows");
  } catch (e: any) {
    console.error("FAIL prisma.conversation.findMany:", e.message);
  }
}

main()
  .catch((e) => console.error("FATAL:", e))
  .finally(() => process.exit(0));
