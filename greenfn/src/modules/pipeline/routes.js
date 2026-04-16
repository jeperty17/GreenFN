const express = require("express");
const prisma = require("../../lib/prisma");
const { httpError } = require("../../utils/httpError");
const { validateBody, requiredString } = require("../../middleware/validate");

const router = express.Router();

const DEFAULT_ADVISOR_ID = "seed-user-001";

function getAdvisorId(req) {
  return req.authUser?.id || DEFAULT_ADVISOR_ID;
}

// GET /api/pipeline
// Returns all PipelineStages for the advisor in order, each with their contacts.
// Each contact includes openTaskCount (OPEN NextSteps) and lastInteractionAt.
router.get("/", async (req, res, next) => {
  try {
    const advisorId = getAdvisorId(req);
    const stages = await prisma.pipelineStage.findMany({
      where: { advisorId },
      orderBy: { order: "asc" },
      select: { id: true, advisorId: true, name: true, order: true },
    });

    const stageIds = stages.map((stage) => stage.id);
    const contacts =
      stageIds.length > 0
        ? await prisma.contact.findMany({
            where: {
              advisorId,
              stageId: { in: stageIds },
            },
            select: {
              id: true,
              fullName: true,
              type: true,
              source: true,
              stageId: true,
            },
          })
        : [];

    const contactIds = contacts.map((contact) => contact.id);
    const taskCounts =
      contactIds.length > 0
        ? await prisma.nextStep.groupBy({
            by: ["contactId"],
            where: {
              contactId: { in: contactIds },
              status: "OPEN",
            },
            _count: { _all: true },
          })
        : [];
    const taskCountByContactId = new Map(
      taskCounts.map((item) => [item.contactId, item._count._all]),
    );

    const interactions =
      contactIds.length > 0
        ? await prisma.interaction.findMany({
            where: { contactId: { in: contactIds } },
            orderBy: { occurredAt: "desc" },
            select: { contactId: true, occurredAt: true },
          })
        : [];
    const latestInteractionByContactId = new Map();
    for (const interaction of interactions) {
      if (!latestInteractionByContactId.has(interaction.contactId)) {
        latestInteractionByContactId.set(
          interaction.contactId,
          interaction.occurredAt,
        );
      }
    }

    const contactsByStageId = new Map();
    for (const contact of contacts) {
      const stageContacts = contactsByStageId.get(contact.stageId) || [];
      stageContacts.push({
        id: contact.id,
        fullName: contact.fullName,
        type: contact.type,
        source: contact.source,
        stageId: contact.stageId,
        openTaskCount: taskCountByContactId.get(contact.id) || 0,
        lastInteractionAt: latestInteractionByContactId.get(contact.id) || null,
      });
      contactsByStageId.set(contact.stageId, stageContacts);
    }

    const shaped = stages.map((stage) => ({
      ...stage,
      contacts: contactsByStageId.get(stage.id) || [],
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
router.get("/unresolved", async (req, res, next) => {
  try {
    const advisorId = getAdvisorId(req);
    const contacts = await prisma.contact.findMany({
      where: {
        advisorId,
        stageUpdatedAt: { not: null },
      },
      select: {
        id: true,
        fullName: true,
        stageId: true,
        stageUpdatedAt: true,
      },
    });

    const contactIds = contacts.map((contact) => contact.id);
    const stageIds = [
      ...new Set(contacts.map((contact) => contact.stageId).filter(Boolean)),
    ];

    const [stages, interactions, nextSteps] = await Promise.all([
      stageIds.length > 0
        ? prisma.pipelineStage.findMany({
            where: { id: { in: stageIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      contactIds.length > 0
        ? prisma.interaction.findMany({
            where: { contactId: { in: contactIds } },
            orderBy: { createdAt: "desc" },
            select: { contactId: true, createdAt: true },
          })
        : Promise.resolve([]),
      contactIds.length > 0
        ? prisma.nextStep.findMany({
            where: { contactId: { in: contactIds } },
            orderBy: { createdAt: "desc" },
            select: { contactId: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const stageNameById = new Map(
      stages.map((stage) => [stage.id, stage.name]),
    );
    const latestInteractionByContactId = new Map();
    for (const interaction of interactions) {
      if (!latestInteractionByContactId.has(interaction.contactId)) {
        latestInteractionByContactId.set(
          interaction.contactId,
          interaction.createdAt,
        );
      }
    }
    const latestNextStepByContactId = new Map();
    for (const nextStep of nextSteps) {
      if (!latestNextStepByContactId.has(nextStep.contactId)) {
        latestNextStepByContactId.set(nextStep.contactId, nextStep.createdAt);
      }
    }

    const unresolved = contacts
      .filter((c) => {
        const lastInteraction = latestInteractionByContactId.get(c.id) || null;
        const lastNextStep = latestNextStepByContactId.get(c.id) || null;
        const hasFollowUp =
          (lastInteraction && lastInteraction > c.stageUpdatedAt) ||
          (lastNextStep && lastNextStep > c.stageUpdatedAt);
        return !hasFollowUp;
      })
      .map((c) => ({
        id: c.id,
        fullName: c.fullName,
        stageName: c.stageId ? stageNameById.get(c.stageId) || null : null,
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
      const advisorId = getAdvisorId(req);
      const { name } = req.body;

      // Find the current highest order value to place the new stage at the end
      const last = await prisma.pipelineStage.findFirst({
        where: { advisorId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const nextOrder = last ? last.order + 1 : 0; // start at 0 if no stages exist

      const stage = await prisma.pipelineStage.create({
        data: {
          advisorId,
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
      const advisorId = getAdvisorId(req);
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
        where: { id: { in: ids }, advisorId },
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
      const advisorId = getAdvisorId(req);
      const { stageId } = req.params;
      const { name } = req.body;

      const existing = await prisma.pipelineStage.findUnique({
        where: { id: stageId },
        select: { id: true, advisorId: true },
      });

      if (!existing) {
        throw httpError(404, "Stage not found");
      }
      if (existing.advisorId !== advisorId) {
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
    const advisorId = getAdvisorId(req);
    const { stageId } = req.params;

    const existing = await prisma.pipelineStage.findUnique({
      where: { id: stageId },
      select: { id: true, advisorId: true },
    });

    if (!existing) {
      throw httpError(404, "Stage not found");
    }
    if (existing.advisorId !== advisorId) {
      throw httpError(403, "Stage does not belong to this advisor");
    }

    // Find the first remaining stage (excluding the one being deleted) to use as fallback
    const fallback = await prisma.pipelineStage.findFirst({
      where: { advisorId, id: { not: stageId } },
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
      const advisorId = getAdvisorId(req);
      const { contactId } = req.params;
      const { stageId } = req.body;

      const contact = await prisma.contact.findUnique({
        // validate contact exists and belongs to advisor
        where: { id: contactId },
        select: { id: true, advisorId: true },
      });

      if (!contact) {
        throw httpError(404, "Contact not found");
      }
      if (contact.advisorId !== advisorId) {
        throw httpError(403, "Forbidden");
      }

      const stage = await prisma.pipelineStage.findUnique({
        // validate stage exists and belongs to advisor
        where: { id: stageId },
        select: { id: true, advisorId: true },
      });

      if (!stage) {
        throw httpError(404, "Stage not found");
      }
      if (stage.advisorId !== advisorId) {
        throw httpError(403, "Stage does not belong to this advisor");
      }

      const updated = await prisma.contact.update({
        // update contact with new stage and new stageUpdatedAt
        where: { id: contactId },
        data: {
          stageId,
          stageUpdatedAt: new Date(),
        },
        select: {
          id: true,
          fullName: true,
          stageId: true,
          stageUpdatedAt: true,
        },
      });

      res.json({ contact: updated });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
