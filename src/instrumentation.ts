export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __sekavoCron?: boolean };
  if (g.__sekavoCron) return;
  g.__sekavoCron = true;

  if (process.env.DISABLE_INTERNAL_CRON === "1") return;

  const cron = await import("node-cron");
  const { runWorkerLoop } = await import("./lib/worker");
  cron.schedule("* * * * *", () => {
    runWorkerLoop().catch((e) => console.error("[worker] loop failed", e));
  });
  console.log("[worker] internal cron scheduled (every minute)");
}
