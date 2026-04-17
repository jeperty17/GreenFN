const prisma = require("../../lib/prisma");
const {
  getDateKeyInTimeZone,
  getSingaporeDayBounds,
  getSingaporeTodayDateKey,
} = require("./timezone");
const { TASK_ACTIVITY_TYPES, recordTaskActivity } = require("./activity");

function buildReminderDetail(taskKey, todayKey) {
  if (taskKey < todayKey) {
    return `Task is overdue and was due on ${taskKey}.`;
  }

  return `Task is due today (${taskKey}).`;
}

async function scanTaskReminders({
  prismaClient = prisma,
  advisorId,
  now = new Date(),
} = {}) {
  const todayKey = getSingaporeTodayDateKey(now);
  const { start: scheduledFor, end } = getSingaporeDayBounds(now);

  const taskWhere = {
    status: "OPEN",
    dueAt: { lte: end },
    ...(advisorId ? { contact: { advisorId } } : {}),
  };

  const tasks = await prismaClient.nextStep.findMany({
    where: taskWhere,
    select: {
      id: true,
      title: true,
      dueAt: true,
      status: true,
      contactId: true,
      contact: {
        select: {
          id: true,
          fullName: true,
          advisorId: true,
        },
      },
    },
  });

  const reminderCandidates = tasks.filter((task) => {
    const taskKey = getDateKeyInTimeZone(task.dueAt);
    return taskKey <= todayKey;
  });

  if (reminderCandidates.length === 0) {
    return {
      scannedCount: 0,
      createdCount: 0,
      scheduledFor,
      reminders: [],
    };
  }

  const existingLogs = await prismaClient.taskActivityLog.findMany({
    where: {
      activityType: TASK_ACTIVITY_TYPES.REMINDER_TRIGGERED,
      scheduledFor,
      taskId: {
        in: reminderCandidates.map((task) => task.id),
      },
    },
    select: { taskId: true },
  });

  const existingTaskIds = new Set(
    existingLogs.map((log) => log.taskId).filter(Boolean),
  );

  const reminders = [];
  for (const task of reminderCandidates) {
    if (existingTaskIds.has(task.id)) {
      continue;
    }

    const taskKey = getDateKeyInTimeZone(task.dueAt);
    const reminder = await recordTaskActivity(prismaClient, {
      task,
      contact: task.contact,
      advisorId: task.contact.advisorId,
      activityType: TASK_ACTIVITY_TYPES.REMINDER_TRIGGERED,
      detail: buildReminderDetail(taskKey, todayKey),
      metadata: {
        dueDateKey: taskKey,
        scheduledFor: scheduledFor.toISOString(),
        triggerSource: "scheduled-task-check",
      },
      scheduledFor,
    });

    if (reminder) {
      reminders.push(reminder);
    }
  }

  return {
    scannedCount: reminderCandidates.length,
    createdCount: reminders.length,
    scheduledFor,
    reminders,
  };
}

module.exports = {
  scanTaskReminders,
};
