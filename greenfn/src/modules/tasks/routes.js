const express = require("express");
const prisma = require("../../lib/prisma");
const { httpError } = require("../../utils/httpError");
const { validateBody, requiredString } = require("../../middleware/validate");

const router = express.Router();

const DEFAULT_ADVISOR_ID = "seed-user-001";

const ALLOWED_STATUSES = new Set(["OPEN", "DONE", "CANCELED"]);

function getAdvisorId(req) {
  return req.authUser?.id || DEFAULT_ADVISOR_ID;
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

    const advisorContacts = await prisma.contact.findMany({
      where: { advisorId },
      select: {
        id: true,
        fullName: true,
        stageId: true,
      },
    });
    const contactById = new Map(
      advisorContacts.map((contact) => [contact.id, contact]),
    );
    const contactIds = advisorContacts.map((contact) => contact.id);
    const stageIds = [
      ...new Set(
        advisorContacts.map((contact) => contact.stageId).filter(Boolean),
      ),
    ];
    const stages =
      stageIds.length > 0
        ? await prisma.pipelineStage.findMany({
            where: { id: { in: stageIds } },
            select: { id: true, name: true },
          })
        : [];
    const stageNameById = new Map(
      stages.map((stage) => [stage.id, stage.name]),
    );

    const tasks = await prisma.nextStep.findMany({
      where: {
        status: "OPEN",
        dueAt: { not: null },
        contactId: { in: contactIds.length > 0 ? contactIds : ["__none__"] },
      },
      orderBy: { dueAt: "asc" },
    });

    const formatTask = (task) => ({
      contactName:
        contactById.get(task.contactId)?.fullName || "Unknown Contact",
      stageName: (() => {
        const stageId = contactById.get(task.contactId)?.stageId;
        return stageId ? stageNameById.get(stageId) || null : null;
      })(),
      id: task.id,
      title: task.title,
      description: task.description,
      dueAt: task.dueAt,
      status: task.status,
      contactId: task.contactId,
    });

    // Calendar view: return all OPEN tasks as a flat array
    if (isCalendar) {
      return res.json({ tasks: tasks.map(formatTask) });
    }

    // List view: bucket tasks into overdue / dueToday / upcoming
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const endOfUpcoming = new Date(startOfToday);
    endOfUpcoming.setDate(endOfUpcoming.getDate() + 8); // covers today+1 through today+7

    const overdue = [];
    const dueToday = [];
    const upcoming = [];

    for (const task of tasks) {
      const data = formatTask(task);
      if (task.dueAt < startOfToday) {
        overdue.push(data);
      } else if (task.dueAt < startOfTomorrow) {
        dueToday.push(data);
      } else if (task.dueAt < endOfUpcoming) {
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
    requiredString(description, "description", errors);
    if (!dueAt) errors.push({ field: "dueAt", message: "dueAt is required" });
    return errors;
  }),
  async (req, res, next) => {
    try {
      const advisorId = getAdvisorId(req);
      const { contactId, title, description, dueAt } = req.body;

      const parsedDueAt = new Date(dueAt);
      if (isNaN(parsedDueAt.getTime())) {
        throw httpError(400, "Validation failed", [
          { field: "dueAt", message: "dueAt must be a valid date" },
        ]);
      }

      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { advisorId: true },
      });
      if (!contact) {
        throw httpError(404, "Contact not found");
      }
      if (contact.advisorId !== advisorId) {
        throw httpError(403, "Forbidden");
      }

      // create task with status OPEN
      const task = await prisma.nextStep.create({
        data: {
          contactId,
          title,
          description,
          dueAt: parsedDueAt,
          status: "OPEN",
        },
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
        select: { id: true, contactId: true },
      });

      if (!existingTask) {
        throw httpError(404, "Task not found");
      }

      const contact = await prisma.contact.findUnique({
        where: { id: existingTask.contactId },
        select: { advisorId: true },
      });

      if (!contact || contact.advisorId !== advisorId) {
        throw httpError(403, "Forbidden");
      }

      const task = await prisma.nextStep.update({
        where: { id: taskId },
        data,
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
      select: { id: true, contactId: true },
    });

    if (!task) {
      throw httpError(404, "Task not found");
    }

    const contact = await prisma.contact.findUnique({
      where: { id: task.contactId },
      select: { advisorId: true },
    });

    if (!contact || contact.advisorId !== advisorId) {
      throw httpError(403, "Forbidden");
    }

    await prisma.nextStep.delete({ where: { id: taskId } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
