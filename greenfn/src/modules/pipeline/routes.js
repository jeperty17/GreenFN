const express = require("express");
const prisma = require("../../lib/prisma");
const { httpError } = require("../../utils/httpError");
const { validateBody, requiredString } = require("../../middleware/validate");

const router = express.Router();

// Hard-coded until auth is implemented
const ADVISOR_ID = "seed-user-001";

const TERMINAL_STAGES = new Set(["closed won", "closed lost"]);

const ALLOWED_STAGE_TRANSITIONS = {
  new: new Set(["contacted", "closed lost"]),
  contacted: new Set(["booked", "no-show", "closed lost"]),
  booked: new Set(["in progress", "no-show", "closed lost"]),
  "no-show": new Set(["contacted", "closed lost"]),
  "in progress": new Set(["closed won", "closed lost", "contacted"]),
  "closed won": new Set([]),
  "closed lost": new Set(["contacted"]),
};

function normalizeStageName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function buildYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function logPipelineEvent(event, metadata = {}) {
  const payload = {
    event,
    feature: "pipeline",
    at: new Date().toISOString(),
    ...metadata,
  };
  console.info("[pipeline]", JSON.stringify(payload));
}

function assertValidStageTransition({ fromStageName, toStageName }) {
  const from = normalizeStageName(fromStageName);
  const to = normalizeStageName(toStageName);

  if (!from || !to || from === to) {
    return;
  }

  if (TERMINAL_STAGES.has(from) && !ALLOWED_STAGE_TRANSITIONS[from]?.has(to)) {
    throw httpError(422, "Invalid stage transition", {
      fromStageName,
      toStageName,
      reason: "Cannot move from terminal stage without explicit reopen path",
    });
  }

  const allowed = ALLOWED_STAGE_TRANSITIONS[from];
  if (!allowed) {
    // Custom stage names are allowed by default to avoid blocking user-defined pipelines.
    return;
  }

  if (!allowed.has(to)) {
    throw httpError(422, "Invalid stage transition", {
      fromStageName,
      toStageName,
      reason: `Allowed transitions from ${fromStageName}: ${Array.from(allowed).join(", ") || "none"}`,
    });
  }
}

function buildFollowUpSuggestion({ fromStageName, toStageName, contactName }) {
  const to = normalizeStageName(toStageName);
  const now = new Date();
  let dueDate = new Date(now);
  let message =
    "Add a follow-up touchpoint to keep momentum after this stage change.";

  if (to === "contacted") {
    dueDate.setDate(dueDate.getDate() + 2);
    message =
      "Suggest scheduling the next call within 48 hours to maintain response momentum.";
  } else if (to === "booked") {
    dueDate.setDate(dueDate.getDate() + 1);
    message =
      "Suggest confirming agenda and reminders before the booked meeting.";
  } else if (to === "no-show") {
    dueDate.setDate(dueDate.getDate() + 1);
    message =
      "Suggest a recovery outreach with a new proposed slot after no-show.";
  } else if (to === "in progress") {
    dueDate.setDate(dueDate.getDate() + 3);
    message =
      "Suggest setting a clear decision checkpoint while the case is in progress.";
  } else if (to === "closed won") {
    dueDate.setDate(dueDate.getDate() + 7);
    message =
      "Suggest a post-close check-in task for onboarding and relationship continuity.";
  } else if (to === "closed lost") {
    dueDate.setDate(dueDate.getDate() + 14);
    message =
      "Suggest a re-engagement reminder in two weeks with updated value proposition.";
  }

  return {
    triggered: true,
    triggerType: "pipeline-stage-change",
    contactName,
    fromStageName,
    toStageName,
    message,
    suggestedDueDateYmd: buildYmd(dueDate),
    suggestedTaskTitle: `Follow up with ${contactName}`,
  };
}

// GET /api/pipeline
// Returns all PipelineStages for the advisor in order, each with their contacts.
// Each contact includes openTaskCount (OPEN NextSteps) and lastInteractionAt.
router.get("/", async (_req, res, next) => {
  try {
    const stages = await prisma.pipelineStage.findMany({
      where: { advisorId: ADVISOR_ID },
      orderBy: { order: "asc" }, // user defined order for pipeline stages (eg 0 = "New Lead", 1 = "Contacted", etc)
      include: {
        contacts: {
          select: {
            id: true,
            fullName: true,
            type: true,
            source: true,
            stageId: true,
            // count only open tasks for the task badge on each card
            _count: {
              select: { nextSteps: { where: { status: "OPEN" } } },
            },
            // most recent interaction for the "N days ago" badge
            interactions: {
              select: { occurredAt: true },
              orderBy: { occurredAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    // Flatten _count and interaction into top-level fields for the frontend
    const shaped = stages.map((stage) => ({
      ...stage,
      contacts: stage.contacts.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        type: c.type,
        source: c.source,
        stageId: c.stageId,
        openTaskCount: c._count.nextSteps,
        lastInteractionAt: c.interactions[0]?.occurredAt ?? null,
      })),
    }));

    res.json({ stages: shaped });
  } catch (error) {
    next(error); // handled by errorHandler middleware
  }
});

// GET /api/pipeline/unresolved
//
// Returns contacts whose stage was updated (stageUpdatedAt is set) but have no
// Interaction or NextStep created after that timestamp — i.e. the transition was
// never followed up. Feeds the Today View login modal.
router.get("/unresolved", async (_req, res, next) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: {
        advisorId: ADVISOR_ID,
        stageUpdatedAt: { not: null },
      },
      select: {
        // only select fields needed
        id: true,
        fullName: true,
        stageUpdatedAt: true,
        stage: { select: { name: true } },
        interactions: {
          // get most recent interaction per contact
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        nextSteps: {
          // get most recent nextStep per contact
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const unresolved = contacts
      .filter((c) => {
        // check if there is an interaction, if so, compare its createdAt against stageUpdatedAt
        const lastInteraction = c.interactions[0]?.createdAt ?? null;
        // same for nextStep
        const lastNextStep = c.nextSteps[0]?.createdAt ?? null;
        const hasFollowUp =
          (lastInteraction && lastInteraction > c.stageUpdatedAt) ||
          (lastNextStep && lastNextStep > c.stageUpdatedAt);
        return !hasFollowUp;
      }) // result is contacts that had a stage change but no follow-up interaction or nextStep
      .map((c) => ({
        // only return fields needed by frontend
        id: c.id,
        fullName: c.fullName,
        stageName: c.stage?.name ?? null,
        stageUpdatedAt: c.stageUpdatedAt,
      }));

    res.json({ unresolved });
  } catch (error) {
    next(error); // handled by errorHandler middleware
  }
});

// POST /api/pipeline/stages
// Creates a new pipeline stage for the advisor.
// Auto-assigns the next available order value (max existing order + 1).
router.post(
  "/stages",
  validateBody(({ name }) => {
    const errors = [];
    requiredString(name, "name", errors);
    return errors;
  }),
  async (req, res, next) => {
    try {
      const { name } = req.body;

      // Find the current highest order value to place the new stage at the end
      const last = await prisma.pipelineStage.findFirst({
        where: { advisorId: ADVISOR_ID },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const nextOrder = last ? last.order + 1 : 0; // start at 0 if no stages exist

      const stage = await prisma.pipelineStage.create({
        data: {
          advisorId: ADVISOR_ID,
          name: name.trim(),
          order: nextOrder,
        },
      });

      res.status(201).json({ stage });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/pipeline/stages/reorder
// Updates the order field for each stage in the provided list.
// Body: { stages: [{ id, order }] }
// Validates all stages belong to the advisor before writing.
router.patch(
  "/stages/reorder",
  validateBody(({ stages }) => {
    const errors = [];
    if (!Array.isArray(stages) || stages.length === 0) {
      errors.push({
        field: "stages",
        message: "stages must be a non-empty array",
      });
    }
    return errors;
  }),
  async (req, res, next) => {
    try {
      const { stages } = req.body;

      // Validate every entry has id (string) and order (number)
      for (const entry of stages) {
        if (typeof entry.id !== "string" || entry.id.trim() === "") {
          throw httpError(400, "Each stage entry must have a valid id");
        }
        if (typeof entry.order !== "number") {
          throw httpError(400, "Each stage entry must have a numeric order");
        }
      }

      // Confirm all supplied stage IDs belong to this advisor
      const ids = stages.map((s) => s.id);
      const existing = await prisma.pipelineStage.findMany({
        where: { id: { in: ids }, advisorId: ADVISOR_ID },
        select: { id: true },
      });

      if (existing.length !== ids.length) {
        throw httpError(
          403,
          "One or more stages do not belong to this advisor",
        );
      }

      // PipelineStage has @@unique([advisorId, order]), so swapping two order
      // values inside a single sequential transaction still raises a uniqueness
      // violation because PostgreSQL checks the constraint after every row, not
      // at the end of the whole transaction.
      //
      // Two-pass strategy inside one interactive transaction:
      //   Pass 1 — move all stages to a temporary high-offset range (1 000 000 + i).
      //            Every value in this range is unique and far from any real order.
      //   Pass 2 — write the final order values. By this point no stage in the
      //            affected set still holds a value in the 0..n range, so there
      //            are no intermediate conflicts.
      // The whole thing is one atomic transaction so no reader sees the temp values.
      const TEMP_BASE = 1_000_000;

      await prisma.$transaction(async (tx) => {
        // Pass 1: shift all to temporary values
        for (let i = 0; i < stages.length; i++) {
          await tx.pipelineStage.update({
            where: { id: stages[i].id },
            data: { order: TEMP_BASE + i },
          });
        }
        // Pass 2: write the requested final values
        for (const { id, order } of stages) {
          await tx.pipelineStage.update({
            where: { id },
            data: { order },
          });
        }
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/pipeline/stages/:stageId
// Renames a stage. Only allows updating the name field.
// Validates the stage belongs to the advisor.
router.patch(
  "/stages/:stageId",
  validateBody(({ name }) => {
    const errors = [];
    requiredString(name, "name", errors);
    return errors;
  }),
  async (req, res, next) => {
    try {
      const { stageId } = req.params;
      const { name } = req.body;

      const existing = await prisma.pipelineStage.findUnique({
        where: { id: stageId },
        select: { id: true, advisorId: true },
      });

      if (!existing) {
        throw httpError(404, "Stage not found");
      }
      if (existing.advisorId !== ADVISOR_ID) {
        throw httpError(403, "Stage does not belong to this advisor");
      }

      const stage = await prisma.pipelineStage.update({
        where: { id: stageId },
        data: { name: name.trim() },
      });

      res.json({ stage });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/pipeline/stages/:stageId
// Deletes a stage. If the stage has contacts, moves them to the first available
// stage for this advisor before deleting. Does not block deletion.
router.delete("/stages/:stageId", async (req, res, next) => {
  try {
    const { stageId } = req.params;

    const existing = await prisma.pipelineStage.findUnique({
      where: { id: stageId },
      select: { id: true, advisorId: true },
    });

    if (!existing) {
      throw httpError(404, "Stage not found");
    }
    if (existing.advisorId !== ADVISOR_ID) {
      throw httpError(403, "Stage does not belong to this advisor");
    }

    // Find the first remaining stage (excluding the one being deleted) to use as fallback
    const fallback = await prisma.pipelineStage.findFirst({
      where: { advisorId: ADVISOR_ID, id: { not: stageId } },
      orderBy: { order: "asc" },
      select: { id: true },
    });

    if (fallback) {
      // Move all contacts currently in the deleted stage to the fallback stage
      await prisma.contact.updateMany({
        where: { stageId },
        data: { stageId: fallback.id },
      });
    }
    // If no fallback exists (only one stage), contacts will have their stageId nulled
    // by the DB cascade or left intact — we just delete and let the schema handle it.

    await prisma.pipelineStage.delete({ where: { id: stageId } });

    res.json({ success: true, movedToStageId: fallback?.id ?? null });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/pipeline/:contactId/stage
// Updates a contact's stageId and stageUpdatedAt.
// Validates that the target stage exists and belongs to the same advisor.
router.patch(
  "/:contactId/stage",
  validateBody(({ stageId }) => {
    const errors = [];
    requiredString(stageId, "stageId", errors);
    return errors;
  }),
  async (req, res, next) => {
    try {
      const { contactId } = req.params;
      const { stageId } = req.body;

      const contact = await prisma.contact.findUnique({
        // validate contact exists and belongs to advisor
        where: { id: contactId },
        select: {
          id: true,
          advisorId: true,
          fullName: true,
          stageId: true,
          stage: { select: { id: true, name: true } },
        },
      });

      if (!contact) {
        throw httpError(404, "Contact not found");
      }
      if (contact.advisorId !== ADVISOR_ID) {
        throw httpError(403, "Forbidden");
      }

      const stage = await prisma.pipelineStage.findUnique({
        // validate stage exists and belongs to advisor
        where: { id: stageId },
        select: { id: true, advisorId: true, name: true },
      });

      if (!stage) {
        throw httpError(404, "Stage not found");
      }
      if (stage.advisorId !== ADVISOR_ID) {
        throw httpError(403, "Stage does not belong to this advisor");
      }

      const fromStageName = contact.stage?.name || "Unstaged";
      const toStageName = stage.name;
      assertValidStageTransition({ fromStageName, toStageName });

      const transitionedAt = new Date();

      const updated = await prisma.contact.update({
        // update contact with new stage and new stageUpdatedAt
        where: { id: contactId },
        data: {
          stageId,
          stageUpdatedAt: transitionedAt,
        },
        select: {
          id: true,
          fullName: true,
          stageId: true,
          stageUpdatedAt: true,
        },
      });

      await prisma.pipelineStageTransition.create({
        data: {
          contactId,
          advisorId: ADVISOR_ID,
          fromStageId: contact.stageId,
          fromStageName,
          toStageId: stage.id,
          toStageName,
          transitionedAt,
        },
      });

      const followUpSuggestion = buildFollowUpSuggestion({
        fromStageName,
        toStageName,
        contactName: contact.fullName,
      });

      logPipelineEvent("stage_transition_succeeded", {
        contactId,
        contactName: contact.fullName,
        fromStageId: contact.stageId,
        fromStageName,
        toStageId: stage.id,
        toStageName,
        transitionedAt: transitionedAt.toISOString(),
        suggestionDueDateYmd: followUpSuggestion.suggestedDueDateYmd,
      });

      res.json({
        contact: updated,
        followUpSuggestion,
      });
    } catch (error) {
      if (error?.statusCode === 422) {
        logPipelineEvent("stage_transition_rejected", {
          contactId: req.params.contactId,
          stageId: req.body?.stageId || null,
          reason:
            error?.details?.reason || error?.message || "invalid transition",
        });
      }
      next(error);
    }
  },
);

module.exports = router;
