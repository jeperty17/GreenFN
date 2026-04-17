const { TASK_REMINDER_ALERT_WEBHOOK_URL } = require("../../config/env");

async function sendTaskReminderFailureAlert(error, context = {}) {
  const payload = {
    service: "task-reminder-worker",
    severity: "error",
    message:
      error instanceof Error ? error.message : "Unknown task reminder failure",
    stack: error instanceof Error ? error.stack || null : null,
    context,
    at: new Date().toISOString(),
  };

  if (!TASK_REMINDER_ALERT_WEBHOOK_URL) {
    console.error(
      "[task-reminder-worker] alert webhook not configured",
      JSON.stringify(payload),
    );
    return { delivered: false, reason: "missing-webhook" };
  }

  if (typeof fetch !== "function") {
    console.error(
      "[task-reminder-worker] fetch unavailable for alert delivery",
      JSON.stringify(payload),
    );
    return { delivered: false, reason: "fetch-unavailable" };
  }

  try {
    const response = await fetch(TASK_REMINDER_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        "[task-reminder-worker] alert webhook failed",
        response.status,
        response.statusText,
      );
      return { delivered: false, reason: `webhook-${response.status}` };
    }

    return { delivered: true };
  } catch (alertError) {
    console.error("[task-reminder-worker] failed to deliver alert", alertError);
    return { delivered: false, reason: "delivery-error" };
  }
}

module.exports = {
  sendTaskReminderFailureAlert,
};
