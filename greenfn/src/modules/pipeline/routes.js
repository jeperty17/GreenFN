const express = require("express");
const prisma = require("../../lib/prisma");
const { httpError } = require("../../utils/httpError");
const { validateBody, requiredString } = require("../../middleware/validate");

const router = express.Router();

// Hard-coded until auth is implemented
const ADVISOR_ID = "seed-user-001";

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
        select: { id: true, advisorId: true },
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
        select: { id: true, advisorId: true },
      });

      if (!stage) {
        throw httpError(404, "Stage not found");
      }
      if (stage.advisorId !== ADVISOR_ID) {
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
