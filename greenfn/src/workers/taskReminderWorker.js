require("dotenv/config");

const prisma = require("../lib/prisma");
const { scanTaskReminders } = require("../modules/tasks/reminders");
const { sendTaskReminderFailureAlert } = require("../modules/tasks/alerts");

async function main() {
  try {
    const result = await scanTaskReminders({ prismaClient: prisma });
    console.log(
      "[task-reminder-worker] scan complete",
      JSON.stringify({
        scannedCount: result.scannedCount,
        createdCount: result.createdCount,
        scheduledFor: result.scheduledFor.toISOString(),
      }),
    );
  } catch (error) {
    console.error("[task-reminder-worker] scan failed", error);
    await sendTaskReminderFailureAlert(error, {
      worker: "task-reminder-worker",
    });
    process.exitCode = 1;
  } finally {
    if (typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error("[task-reminder-worker] fatal error", error);
    await sendTaskReminderFailureAlert(error, {
      worker: "task-reminder-worker",
      fatal: true,
    });
    process.exit(1);
  });
}

module.exports = { main };
