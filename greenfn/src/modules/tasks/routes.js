const express = require("express");
const prisma = require("../../lib/prisma");
const { httpError } = require("../../utils/httpError");
const { validateBody, requiredString } = require("../../middleware/validate");
const { recordTaskActivity, TASK_ACTIVITY_TYPES } = require("./activity");
const {
  getDateKeyInTimeZone,
  getSingaporeTodayDateKey,
} = require("./timezone");

const router = express.Router();

const ALLOWED_STATUSES = new Set(["OPEN", "DONE", "CANCELED"]);

function getAdvisorId(req) {
  const advisorId = req.authUser?.id;
  if (!advisorId) {
    throw httpError(401, "Authentication required");
  }
  return advisorId;
}

// GET /api/tasks
// Default: returns all OPEN NextSteps (with a dueAt) for the advisor's contacts,
// grouped into overdue / dueToday / upcoming (next 7 days after today).
// ?view=calendar: returns ALL OPEN tasks regardless of due date as a flat array { tasks: [...] }
// Tasks with no dueAt are excluded from all responses.
router.get("/", async (req, res, next) => {
  try {
    const advisorId = getAdvisorId(req);
    const isCalendar = req.query.view === "calendar";

    const tasks = await prisma.nextStep.findMany({
      where: {
        status: "OPEN",
        contact: {
          advisorId,
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        status: true,
        contactId: true,
        contact: {
          select: {
            fullName: true,
            stage: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { dueAt: "asc" },
    });
    const tasksWithDueAt = tasks.filter(
      (task) => task.dueAt && !Number.isNaN(new Date(task.dueAt).getTime()),
    );

    const formatTask = (task) => ({
      contactName: task.contact.fullName?.trim() || "Unnamed Contact",
      stageName: task.contact.stage?.name || null,
      id: task.id,
      title: task.title,
      description: task.description,
      dueAt: task.dueAt,
      status: task.status,
      contactId: task.contactId,
    });

    // Calendar view: return all OPEN tasks as a flat array
    if (isCalendar) {
      return res.json({ tasks: tasksWithDueAt.map(formatTask) });
    }

    // List view: bucket tasks into overdue / dueToday / upcoming
    const todayKey = getSingaporeTodayDateKey();

    const overdue = [];
    const dueToday = [];
    const upcoming = [];

    for (const task of tasksWithDueAt) {
      const data = formatTask(task);
      const dueDateKey = getDateKeyInTimeZone(task.dueAt);

      if (dueDateKey < todayKey) {
        overdue.push(data);
      } else if (dueDateKey === todayKey) {
        dueToday.push(data);
      } else {
        upcoming.push(data);
      }
    }

    res.json({ overdue, dueToday, upcoming });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks
// Creates a new NextStep for a contact

router.post(
  "/",
  validateBody(({ contactId, title, description, dueAt }) => {
    const errors = [];
    requiredString(contactId, "contactId", errors);
    requiredString(title, "title", errors);
    if (description !== undefined && typeof description !== "string") {
      errors.push({
        field: "description",
        message: "description must be a string",
      });
    }
    if (!dueAt) errors.push({ field: "dueAt", message: "dueAt is required" });
    return errors;
  }),
  async (req, res, next) => {
    try {
      const advisorId = getAdvisorId(req);
      const { contactId, title, description, dueAt } = req.body;
      const safeDescription =
        typeof description === "string" ? description.trim() : "";

      const parsedDueAt = new Date(dueAt);
      if (isNaN(parsedDueAt.getTime())) {
        throw httpError(400, "Validation failed", [
          { field: "dueAt", message: "dueAt must be a valid date" },
        ]);
      }

      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { advisorId: true, fullName: true },
      });
      if (!contact) {
        throw httpError(404, "Contact not found");
      }
      if (contact.advisorId !== advisorId) {
        throw httpError(403, "Forbidden");
      }

      const task = await prisma.$transaction(async (tx) => {
        const createdTask = await tx.nextStep.create({
          data: {
            contactId,
            title,
            description: safeDescription,
            dueAt: parsedDueAt,
            status: "OPEN",
          },
        });

        await recordTaskActivity(tx, {
          task: createdTask,
          contact,
          advisorId,
          activityType: TASK_ACTIVITY_TYPES.CREATED,
          detail: `Created task for ${contact.fullName || "Unknown Contact"}.`,
          metadata: {
            source: "api",
          },
        });

        return createdTask;
      });

      res.status(201).json({ task });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/tasks/:taskId
// Updates an existing NextStep. Fields that can be updated: status, dueAt, title, description

router.patch(
  "/:taskId",
  validateBody(({ status, dueAt, title, description }) => {
    const errors = [];

    // at least one field must be provided
    if (
      status === undefined &&
      dueAt === undefined &&
      title === undefined &&
      description === undefined
    ) {
      errors.push({ field: "body", message: "at least one field is required" });
      return errors;
    }

    if (status !== undefined && !ALLOWED_STATUSES.has(status)) {
      errors.push({
        field: "status",
        message: `status must be one of: ${[...ALLOWED_STATUSES].join(", ")}`,
      });
    }
    if (title !== undefined) requiredString(title, "title", errors);
    if (description !== undefined)
      requiredString(description, "description", errors);
    if (dueAt !== undefined && isNaN(new Date(dueAt).getTime())) {
      errors.push({ field: "dueAt", message: "dueAt must be a valid date" });
    }

    return errors;
  }),
  async (req, res, next) => {
    try {
      const advisorId = getAdvisorId(req);
      const { taskId } = req.params;
      const { status, dueAt, title, description } = req.body;

      let parsedDueAt;
      if (dueAt !== undefined) parsedDueAt = new Date(dueAt);

      const data = {};
      if (status !== undefined) {
        data.status = status;
        if (status === "DONE") data.completedAt = new Date();
      }
      if (parsedDueAt !== undefined) data.dueAt = parsedDueAt;
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;

      const existingTask = await prisma.nextStep.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          contactId: true,
          title: true,
          description: true,
          dueAt: true,
          status: true,
        },
      });

      if (!existingTask) {
        throw httpError(404, "Task not found");
      }

      const contact = await prisma.contact.findUnique({
        where: { id: existingTask.contactId },
        select: { advisorId: true, fullName: true },
      });

      if (!contact || contact.advisorId !== advisorId) {
        throw httpError(403, "Forbidden");
      }

      const task = await prisma.$transaction(async (tx) => {
        const updatedTask = await tx.nextStep.update({
          where: { id: taskId },
          data,
        });

        const changedFields = [];
        if (status !== undefined && status !== existingTask.status) {
          changedFields.push(`status to ${status}`);
        }
        if (
          dueAt !== undefined &&
          parsedDueAt?.getTime() !== existingTask.dueAt?.getTime()
        ) {
          changedFields.push("due date");
        }
        if (title !== undefined && title !== existingTask.title) {
          changedFields.push("title");
        }
        if (
          description !== undefined &&
          description !== existingTask.description
        ) {
          changedFields.push("description");
        }

        if (changedFields.length > 0) {
          const activityType =
            status === "DONE"
              ? TASK_ACTIVITY_TYPES.COMPLETED
              : status === "CANCELED"
                ? TASK_ACTIVITY_TYPES.CANCELED
                : TASK_ACTIVITY_TYPES.UPDATED;

          await recordTaskActivity(tx, {
            task: updatedTask,
            contact,
            advisorId,
            activityType,
            detail: `Updated ${changedFields.join(", ")}.`,
            metadata: {
              changedFields,
            },
          });
        }

        return updatedTask;
      });

      res.json({ task });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/tasks/:taskId
// Permanently deletes a NextStep owned by the advisor.
router.delete("/:taskId", async (req, res, next) => {
  try {
    const advisorId = getAdvisorId(req);
    const { taskId } = req.params;

    const task = await prisma.nextStep.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        contactId: true,
        title: true,
        description: true,
        dueAt: true,
        status: true,
      },
    });

    if (!task) {
      throw httpError(404, "Task not found");
    }

    const contact = await prisma.contact.findUnique({
      where: { id: task.contactId },
      select: { advisorId: true, fullName: true },
    });

    if (!contact || contact.advisorId !== advisorId) {
      throw httpError(403, "Forbidden");
    }

    await prisma.$transaction(async (tx) => {
      await recordTaskActivity(tx, {
        task,
        contact,
        advisorId,
        activityType: TASK_ACTIVITY_TYPES.DELETED,
        detail: `Deleted task ${task.title}.`,
        metadata: {
          source: "api",
        },
      });

      await tx.nextStep.delete({ where: { id: taskId } });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
