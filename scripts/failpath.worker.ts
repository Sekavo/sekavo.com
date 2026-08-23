/**
 * Runs a single tick with a deliberately invalid Resend key so the real
 * provider failure path is exercised. Exits 0 if failure handling worked.
 */
process.env.DATABASE_URL ||= "file:./scenario.db";
process.env.RESEND_API_KEY = "re_invalid_key_failure_probe";

async function main() {
  const { runTick } = await import("../src/lib/engine");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();

  // find the marker invoice created by scenario.test.ts
  const inv = await db.invoice.findFirst({
    where: { customer: { email: "failpath@x.test" }, status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (!inv) {
    console.error("no probe invoice found");
    process.exit(2);
  }
  await db.scheduledEmail.updateMany({
    where: { invoiceId: inv.id, status: "pending" },
    data: { plannedFor: new Date(Date.now() - 1000) },
  });

  await runTick();

  const failedRows = await db.scheduledEmail.count({ where: { invoiceId: inv.id, status: "failed" } });
  const failLogs = await db.outboundEmailLog.count({ where: { userId: inv.userId, status: "failed" } });
  console.log(`PROBE failedRows=${failedRows} failLogs=${failLogs}`);
  await db.user.delete({ where: { id: inv.userId } }); // cascade cleanup
  await db.$disconnect();
  process.exit(failedRows >= 1 && failLogs >= 1 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
