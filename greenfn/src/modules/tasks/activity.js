const TASK_ACTIVITY_TYPES = {
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  DELETED: "DELETED",
  REMINDER_TRIGGERED: "REMINDER_TRIGGERED",
};

function buildTaskActivityDetail(activityType, detail) {
  if (detail) {
    return detail;
  }

  switch (activityType) {
    case TASK_ACTIVITY_TYPES.CREATED:
      return "Task created.";
    case TASK_ACTIVITY_TYPES.UPDATED:
      return "Task updated.";
    case TASK_ACTIVITY_TYPES.COMPLETED:
      return "Task completed.";
    case TASK_ACTIVITY_TYPES.CANCELED:
      return "Task canceled.";
    case TASK_ACTIVITY_TYPES.DELETED:
      return "Task deleted.";
    case TASK_ACTIVITY_TYPES.REMINDER_TRIGGERED:
      return "Reminder triggered for task.";
    default:
      return null;
  }
}

async function recordTaskActivity(
  prisma,
  { task, contact, advisorId, activityType, detail, metadata, scheduledFor },
) {
  if (!task || !contact || !activityType) {
    return null;
  }

  try {
    return await prisma.taskActivityLog.create({
      data: {
        taskId: task.id,
        contactId: contact.id,
        advisorId: advisorId || contact.advisorId || null,
        activityType,
        taskTitleSnapshot: task.title,
        contactNameSnapshot: contact.fullName || "Unknown Contact",
        dueAtSnapshot: task.dueAt || null,
        statusSnapshot: task.status,
        detail: buildTaskActivityDetail(activityType, detail),
        metadata: metadata || undefined,
        scheduledFor: scheduledFor || null,
      },
    });
  } catch (error) {
    // Backward-compatibility guard: allow task operations even when
    // task activity log schema isn't applied yet in the active DB.
    const prismaCode = error?.code;
    if (prismaCode === "P2021" || prismaCode === "P2022") {
      return null;
    }
    throw error;
  }
}

module.exports = {
  TASK_ACTIVITY_TYPES,
  recordTaskActivity,
};
