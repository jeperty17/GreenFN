const express = require("express");
const { validateBody, requiredString } = require("../../middleware/validate");
const prisma = require("../../lib/prisma");
const { httpError } = require("../../utils/httpError");
const { logInteractionEvent, toStatusLevel } = require("./logging");

const router = express.Router();

const INTERACTION_TYPES = new Set([
  "CALL",
  "MEETING",
  "WHATSAPP",
  "WHATSAPP_DM",
  "TELEGRAM",
  "INSTAGRAM",
  "EMAIL",
  "NOTE",
  "GENERAL_NOTE",
]);
const INTERACTION_NOTES_MAX_LENGTH = 4000;
const AI_SUMMARY_MARKER = "greenfn-ai-summary-v1";
const AI_SUMMARY_TEXT_MAX_LENGTH = 6000;
const AI_SUMMARY_MODEL_MAX_LENGTH = 120;
const AI_SUMMARY_SOURCE_MODE_MAX_LENGTH = 80;
const OBSERVABLE_METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(String(value || ""), 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return fallbackValue;
  }

  return parsed;
}

function parseSortDirection(value) {
  const normalizedValue = String(value || "desc")
    .trim()
    .toLowerCase();
  return normalizedValue === "asc" ? "asc" : "desc";
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseOccurredAt(value, fieldName, errors) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    errors.push({ field: fieldName, message: `${fieldName} is required` });
    return undefined;
  }

  if (typeof value !== "string") {
    errors.push({ field: fieldName, message: `${fieldName} must be a string` });
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a valid date`,
    });
    return undefined;
  }

  return parsed;
}

function validateType(type, errors, fieldName = "type") {
  if (type === undefined || type === null || type === "") {
    errors.push({ field: fieldName, message: `${fieldName} is required` });
    return;
  }

  if (typeof type !== "string") {
    errors.push({ field: fieldName, message: `${fieldName} must be a string` });
    return;
  }

  const normalizedType = type.trim().toUpperCase();
  if (!INTERACTION_TYPES.has(normalizedType)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be one of ${Array.from(INTERACTION_TYPES).join(", ")}`,
    });
  }
}

function validateNotesField(notes, errors, fieldName = "notes") {
  if (notes === undefined || notes === null) {
    return;
  }

  if (typeof notes !== "string") {
    errors.push({ field: fieldName, message: `${fieldName} must be a string` });
    return;
  }

  if (notes.length > INTERACTION_NOTES_MAX_LENGTH) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must not exceed ${INTERACTION_NOTES_MAX_LENGTH} characters`,
    });
  }
}

function parseOptionalIsoDate(value, fieldName, errors) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    errors.push({ field: fieldName, message: `${fieldName} must be a string` });
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a valid date`,
    });
    return null;
  }

  return parsed;
}

function validateSummaryLink(body) {
  const errors = [];

  if (
    typeof body.summaryText !== "string" ||
    body.summaryText.trim().length === 0
  ) {
    errors.push({ field: "summaryText", message: "summaryText is required" });
  } else if (body.summaryText.length > AI_SUMMARY_TEXT_MAX_LENGTH) {
    errors.push({
      field: "summaryText",
      message: `summaryText must not exceed ${AI_SUMMARY_TEXT_MAX_LENGTH} characters`,
    });
  }

  if (body.model !== undefined && body.model !== null) {
    if (typeof body.model !== "string") {
      errors.push({ field: "model", message: "model must be a string" });
    } else if (body.model.length > AI_SUMMARY_MODEL_MAX_LENGTH) {
      errors.push({
        field: "model",
        message: `model must not exceed ${AI_SUMMARY_MODEL_MAX_LENGTH} characters`,
      });
    }
  }

  if (body.sourceMode !== undefined && body.sourceMode !== null) {
    if (typeof body.sourceMode !== "string") {
      errors.push({
        field: "sourceMode",
        message: "sourceMode must be a string",
      });
    } else if (body.sourceMode.length > AI_SUMMARY_SOURCE_MODE_MAX_LENGTH) {
      errors.push({
        field: "sourceMode",
        message: `sourceMode must not exceed ${AI_SUMMARY_SOURCE_MODE_MAX_LENGTH} characters`,
      });
    }
  }

  parseOptionalIsoDate(body.generatedAt, "generatedAt", errors);

  return errors;
}

function buildStoredSummaryLink(body) {
  const generatedAt = parseOptionalIsoDate(body.generatedAt, "generatedAt", []);

  return JSON.stringify({
    marker: AI_SUMMARY_MARKER,
    summaryText: body.summaryText.trim(),
    model: normalizeOptionalString(body.model),
    sourceMode: normalizeOptionalString(body.sourceMode),
    generatedAt: generatedAt
      ? generatedAt.toISOString()
      : new Date().toISOString(),
  });
}

function buildSummaryRecordData(body) {
  const generatedAt = parseOptionalIsoDate(body.generatedAt, "generatedAt", []);

  return {
    summaryText: body.summaryText.trim(),
    model: normalizeOptionalString(body.model),
    sourceMode: normalizeOptionalString(body.sourceMode),
    generatedAt: generatedAt || new Date(),
  };
}

function parseSummaryLink(aiSummary) {
  if (!aiSummary || typeof aiSummary !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(aiSummary);
    if (parsed?.marker !== AI_SUMMARY_MARKER) {
      return {
        summaryText: aiSummary,
        model: null,
        sourceMode: null,
        generatedAt: null,
      };
    }

    return {
      summaryText: parsed.summaryText || null,
      model: parsed.model || null,
      sourceMode: parsed.sourceMode || null,
      generatedAt: parsed.generatedAt || null,
    };
  } catch (_error) {
    return {
      summaryText: aiSummary,
      model: null,
      sourceMode: null,
      generatedAt: null,
    };
  }
}

function mapSummaryFromRecord(aiSummaryRecord) {
  if (!aiSummaryRecord) {
    return null;
  }

  return {
    summaryText: aiSummaryRecord.summaryText,
    model: aiSummaryRecord.model,
    sourceMode: aiSummaryRecord.sourceMode,
    generatedAt: aiSummaryRecord.generatedAt
      ? aiSummaryRecord.generatedAt.toISOString()
      : null,
  };
}

function validateCreateInteraction(body) {
  const errors = [];
  requiredString(body.contactId, "contactId", errors);
  validateType(body.type, errors);
  parseOccurredAt(body.occurredAt, "occurredAt", errors);

  validateNotesField(body.notes, errors);

  return errors;
}

function validateUpdateInteraction(body) {
  const errors = [];

  if (!body || Object.keys(body).length === 0) {
    errors.push({ field: "body", message: "request body cannot be empty" });
    return errors;
  }

  if (body.type !== undefined) {
    validateType(body.type, errors);
  }

  if (body.occurredAt !== undefined) {
    parseOccurredAt(body.occurredAt, "occurredAt", errors);
  }

  validateNotesField(body.notes, errors);

  return errors;
}

async function resolveAdvisorId() {
  const advisor = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (!advisor) {
    throw httpError(500, "Unable to resolve advisor context for interactions");
  }

  return advisor.id;
}

async function resolveAdvisorContact(contactId, advisorId) {
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      advisorId,
    },
    select: { id: true },
  });

  if (!contact) {
    throw httpError(404, "Requested record was not found", {
      resource: "contact",
      contactId,
    });
  }

  return contact;
}

async function resolveAdvisorInteraction(interactionId, advisorId) {
  const interaction = await prisma.interaction.findFirst({
    where: {
      id: interactionId,
      OR: [{ advisorId }, { contact: { advisorId } }],
    },
    include: {
      contact: {
        select: {
          id: true,
          fullName: true,
        },
      },
      aiSummaryRecord: {
        select: {
          id: true,
          summaryText: true,
          model: true,
          sourceMode: true,
          generatedAt: true,
        },
      },
    },
  });

  if (!interaction) {
    throw httpError(404, "Requested record was not found", {
      resource: "interaction",
      interactionId,
    });
  }

  return interaction;
}

function mapInteraction(interaction) {
  const summaryFromRecord = mapSummaryFromRecord(interaction.aiSummaryRecord);

  return {
    id: interaction.id,
    contactId: interaction.contactId,
    advisorId: interaction.advisorId || null,
    aiSummaryRecordId: interaction.aiSummaryRecordId || null,
    contactName: interaction.contact?.fullName || null,
    type: interaction.type,
    occurredAt: interaction.occurredAt,
    notes: interaction.notes,
    aiSummary: interaction.aiSummary,
    aiSummaryLink: summaryFromRecord || parseSummaryLink(interaction.aiSummary),
    createdAt: interaction.createdAt,
  };
}

function setInteractionObservation(res, operation, metadata = {}) {
  res.locals.interactionObservation = {
    operation,
    ...metadata,
  };
}

router.use((req, res, next) => {
  if (!OBSERVABLE_METHODS.has(req.method)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const observation = res.locals.interactionObservation || {};
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const statusCode = res.statusCode;

    logInteractionEvent(toStatusLevel(statusCode), "interaction.endpoint", {
      method: req.method,
      path: req.baseUrl + req.path,
      operation:
        observation.operation ||
        `${req.method.toLowerCase()}-${req.path.replace(/[/:]/g, "_")}`,
      endpointType: req.method === "GET" ? "read" : "write",
      statusCode,
      durationMs,
      itemCount: observation.itemCount,
      total: observation.total,
      page: observation.page,
      pageSize: observation.pageSize,
      sortDirection: observation.sortDirection,
      advisorId: observation.advisorId,
      contactId: observation.contactId,
      interactionId: observation.interactionId,
    });
  });

  next();
});

router.get("/", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorId();
    const contactId = String(req.query.contactId || "").trim();
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 100);
    const sortDirection = parseSortDirection(req.query.sortDirection);
    const skip = (page - 1) * pageSize;

    if (!contactId) {
      throw httpError(400, "Validation failed", [
        { field: "contactId", message: "contactId is required" },
      ]);
    }

    await resolveAdvisorContact(contactId, advisorId);

    const where = {
      contactId,
      OR: [{ advisorId }, { contact: { advisorId } }],
    };

    const [items, total] = await Promise.all([
      prisma.interaction.findMany({
        where,
        orderBy: [{ occurredAt: sortDirection }, { createdAt: sortDirection }],
        skip,
        take: pageSize,
        include: {
          contact: {
            select: {
              id: true,
              fullName: true,
            },
          },
          aiSummaryRecord: {
            select: {
              id: true,
              summaryText: true,
              model: true,
              sourceMode: true,
              generatedAt: true,
            },
          },
        },
      }),
      prisma.interaction.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    setInteractionObservation(res, "list-interactions", {
      advisorId,
      contactId,
      itemCount: items.length,
      total,
      page,
      pageSize,
      sortDirection,
    });

    res.json({
      items: items.map(mapInteraction),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      sort: {
        field: "occurredAt",
        direction: sortDirection,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:interactionId", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorId();
    const item = await resolveAdvisorInteraction(
      req.params.interactionId,
      advisorId,
    );

    setInteractionObservation(res, "get-interaction", {
      advisorId,
      contactId: item.contactId,
      interactionId: item.id,
    });

    res.json({ item: mapInteraction(item) });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:interactionId/summary-link",
  validateBody(validateSummaryLink),
  async (req, res, next) => {
    try {
      const advisorId = await resolveAdvisorId();
      const existing = await resolveAdvisorInteraction(
        req.params.interactionId,
        advisorId,
      );

      const updated = await prisma.interaction.update({
        where: { id: existing.id },
        data: {
          aiSummary: buildStoredSummaryLink(req.body),
          aiSummaryRecord: existing.aiSummaryRecordId
            ? { update: buildSummaryRecordData(req.body) }
            : { create: buildSummaryRecordData(req.body) },
        },
        include: {
          contact: {
            select: {
              id: true,
              fullName: true,
            },
          },
          aiSummaryRecord: {
            select: {
              id: true,
              summaryText: true,
              model: true,
              sourceMode: true,
              generatedAt: true,
            },
          },
        },
      });

      setInteractionObservation(res, "link-summary", {
        advisorId,
        contactId: updated.contactId,
        interactionId: updated.id,
      });

      res.status(200).json({ item: mapInteraction(updated) });
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/:interactionId/summary-link", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorId();
    const existing = await resolveAdvisorInteraction(
      req.params.interactionId,
      advisorId,
    );

    await prisma.interaction.update({
      where: { id: existing.id },
      data: {
        aiSummary: null,
        aiSummaryRecordId: null,
      },
    });

    setInteractionObservation(res, "unlink-summary", {
      advisorId,
      contactId: existing.contactId,
      interactionId: existing.id,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  validateBody(validateCreateInteraction),
  async (req, res, next) => {
    try {
      const advisorId = await resolveAdvisorId();
      await resolveAdvisorContact(req.body.contactId, advisorId);

      const occurredAtErrors = [];
      const occurredAt =
        parseOccurredAt(req.body.occurredAt, "occurredAt", occurredAtErrors) ||
        new Date();

      if (occurredAtErrors.length > 0) {
        throw httpError(400, "Validation failed", occurredAtErrors);
      }

      const created = await prisma.interaction.create({
        data: {
          contactId: req.body.contactId,
          advisorId,
          type: String(req.body.type).trim().toUpperCase(),
          occurredAt,
          notes: normalizeOptionalString(req.body.notes),
        },
        include: {
          contact: {
            select: {
              id: true,
              fullName: true,
            },
          },
          aiSummaryRecord: {
            select: {
              id: true,
              summaryText: true,
              model: true,
              sourceMode: true,
              generatedAt: true,
            },
          },
        },
      });

      setInteractionObservation(res, "create-interaction", {
        advisorId,
        contactId: created.contactId,
        interactionId: created.id,
      });

      res.status(201).json({ item: mapInteraction(created) });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:interactionId",
  validateBody(validateUpdateInteraction),
  async (req, res, next) => {
    try {
      const advisorId = await resolveAdvisorId();
      const existing = await resolveAdvisorInteraction(
        req.params.interactionId,
        advisorId,
      );

      const occurredAtErrors = [];
      const parsedOccurredAt = parseOccurredAt(
        req.body.occurredAt,
        "occurredAt",
        occurredAtErrors,
      );

      if (occurredAtErrors.length > 0) {
        throw httpError(400, "Validation failed", occurredAtErrors);
      }

      const updated = await prisma.interaction.update({
        where: { id: existing.id },
        data: {
          type:
            req.body.type !== undefined
              ? String(req.body.type).trim().toUpperCase()
              : undefined,
          occurredAt: parsedOccurredAt,
          notes:
            req.body.notes !== undefined
              ? normalizeOptionalString(req.body.notes)
              : undefined,
        },
        include: {
          contact: {
            select: {
              id: true,
              fullName: true,
            },
          },
          aiSummaryRecord: {
            select: {
              id: true,
              summaryText: true,
              model: true,
              sourceMode: true,
              generatedAt: true,
            },
          },
        },
      });

      setInteractionObservation(res, "update-interaction", {
        advisorId,
        contactId: updated.contactId,
        interactionId: updated.id,
      });

      res.json({ item: mapInteraction(updated) });
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/:interactionId", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorId();
    const existing = await resolveAdvisorInteraction(
      req.params.interactionId,
      advisorId,
    );

    await prisma.interaction.delete({
      where: { id: existing.id },
    });

    setInteractionObservation(res, "delete-interaction", {
      advisorId,
      contactId: existing.contactId,
      interactionId: existing.id,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
