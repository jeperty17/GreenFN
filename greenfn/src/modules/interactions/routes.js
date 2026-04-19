const express = require("express");
const { validateBody, requiredString } = require("../../middleware/validate");
const prisma = require("../../lib/prisma");
const { httpError } = require("../../utils/httpError");
const { logInteractionEvent, toStatusLevel } = require("./logging");
const { createAIService } = require("../ai/service");
const { AI_TIMEOUT_MS } = require("../../config/env");

const router = express.Router();
const aiService = createAIService({ timeoutMs: AI_TIMEOUT_MS });

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
const INTERACTION_TITLE_MAX_LENGTH = 180;
const AI_SUMMARY_MARKER = "greenfn-ai-summary-v1";
const AI_SUMMARY_TEXT_MAX_LENGTH = 6000;
const AI_SUMMARY_MODEL_MAX_LENGTH = 120;
const AI_SUMMARY_SOURCE_MODE_MAX_LENGTH = 80;
const OBSERVABLE_METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);
const TASK_EXTRACTION_LIMIT = 5;

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

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseYmdToDate(ymd) {
  if (!/^\d{8}$/.test(String(ymd || ""))) {
    return null;
  }

  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(4, 6));
  const day = Number(ymd.slice(6, 8));
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function stripCodeFence(text) {
  const trimmed = String(text || "").trim();

  if (!trimmed.startsWith("```") || !trimmed.endsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function safeParseJson(text) {
  const normalized = stripCodeFence(text);
  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = normalized.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(candidate);
  } catch (_error) {
    return null;
  }
}

function resolveWeekdayIndex(name) {
  const normalized = String(name || "")
    .trim()
    .toLowerCase();
  const map = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  return Object.prototype.hasOwnProperty.call(map, normalized)
    ? map[normalized]
    : null;
}

function getNextWeekday(baseDate, weekdayIndex) {
  const next = new Date(baseDate);
  const currentWeekday = next.getDay();
  let delta = (weekdayIndex - currentWeekday + 7) % 7;

  if (delta === 0) {
    delta = 7;
  }

  next.setDate(next.getDate() + delta);
  return next;
}

function inferMonthNameDate(text, baseDate) {
  const normalized = String(text || "").toLowerCase();
  const monthMap = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };

  const match = normalized.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?\b/i,
  );

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const monthIndex = monthMap[match[2].toLowerCase()];
  if (
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31 ||
    monthIndex === undefined
  ) {
    return null;
  }

  const explicitYear = match[3] ? Number(match[3]) : null;
  let year = explicitYear || baseDate.getFullYear();
  let parsed = new Date(year, monthIndex, day, 12, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  if (!explicitYear && parsed.getTime() < baseDate.getTime()) {
    year += 1;
    parsed = new Date(year, monthIndex, day, 12, 0, 0, 0);

    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== monthIndex ||
      parsed.getDate() !== day
    ) {
      return null;
    }
  }

  return buildYmd(parsed);
}

function inferYmdFromText(text, baseDate) {
  const normalized = String(text || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }

  const directYmd = normalized.match(/\b(\d{4})(\d{2})(\d{2})\b/);
  if (directYmd) {
    const ymd = `${directYmd[1]}${directYmd[2]}${directYmd[3]}`;
    return parseYmdToDate(ymd) ? ymd : null;
  }

  const isoDate = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDate) {
    const ymd = `${isoDate[1]}${isoDate[2]}${isoDate[3]}`;
    return parseYmdToDate(ymd) ? ymd : null;
  }

  const monthNameDate = inferMonthNameDate(normalized, baseDate);
  if (monthNameDate) {
    return monthNameDate;
  }

  if (normalized.includes("today")) {
    return buildYmd(baseDate);
  }

  if (normalized.includes("tomorrow")) {
    const tomorrow = new Date(baseDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return buildYmd(tomorrow);
  }

  const nextWeekdayMatch = normalized.match(
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );
  if (nextWeekdayMatch) {
    const weekday = resolveWeekdayIndex(nextWeekdayMatch[1]);
    if (weekday !== null) {
      return buildYmd(getNextWeekday(baseDate, weekday));
    }
  }

  const weekdayMatch = normalized.match(
    /\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );
  if (weekdayMatch) {
    const weekday = resolveWeekdayIndex(weekdayMatch[2]);
    if (weekday !== null) {
      return buildYmd(getNextWeekday(baseDate, weekday));
    }
  }

  return null;
}

function normalizeExtractedTask(rawTask, baseDate) {
  if (!rawTask || typeof rawTask !== "object") {
    return null;
  }

  const title = normalizeWhitespace(rawTask.title);
  if (!title) {
    return null;
  }

  const description = normalizeWhitespace(rawTask.description) || title;
  const rawDueDate =
    rawTask.dueDate === null || rawTask.dueDate === undefined
      ? null
      : String(rawTask.dueDate).trim();

  const dueDateYmd = rawDueDate
    ? inferYmdFromText(rawDueDate, baseDate)
    : inferYmdFromText(`${title} ${description}`, baseDate);

  return {
    title: title.slice(0, 100),
    description: description.slice(0, 220),
    dueDateYmd,
  };
}

function fallbackTaskCandidates(summaryText, baseDate) {
  const lines = String(summaryText || "")
    .split(/\r?\n+/)
    .map((line) => normalizeWhitespace(line.replace(/^[-*]\s*/, "")))
    .filter(Boolean);

  return lines
    .filter((line) =>
      /(follow up|follow-up|schedule|call|meeting|send|review|task|remind|prepare)/i.test(
        line,
      ),
    )
    .slice(0, TASK_EXTRACTION_LIMIT)
    .map((line) => ({
      title: line,
      description: `Auto-created from AI summary: ${line}`,
      dueDate: inferYmdFromText(line, baseDate),
    }));
}

async function buildTaskCandidatesFromSummary({ summaryText, generatedAt }) {
  const baseDate = new Date(generatedAt);

  try {
    const extractionResult = await aiService.extractTasksFromSummary({
      summaryText,
      todayYmd: buildYmd(baseDate),
      timezone: "Asia/Singapore",
    });

    const parsed = safeParseJson(extractionResult.text);
    const rawTasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];

    return rawTasks
      .map((task) => normalizeExtractedTask(task, baseDate))
      .filter(Boolean)
      .slice(0, TASK_EXTRACTION_LIMIT);
  } catch (_error) {
    return fallbackTaskCandidates(summaryText, baseDate)
      .map((task) => normalizeExtractedTask(task, baseDate))
      .filter(Boolean)
      .slice(0, TASK_EXTRACTION_LIMIT);
  }
}

async function createTasksFromCandidates({ contactId, candidates }) {
  const seen = new Set();
  const createdTasks = [];

  for (const candidate of candidates) {
    if (!candidate?.dueDateYmd) {
      continue;
    }

    const dueAt = parseYmdToDate(candidate.dueDateYmd);
    if (!dueAt) {
      continue;
    }

    const dedupeKey = `${candidate.title.toLowerCase()}|${candidate.dueDateYmd}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);

    const existing = await prisma.nextStep.findFirst({
      where: {
        contactId,
        title: candidate.title,
        dueAt,
      },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    const task = await prisma.nextStep.create({
      data: {
        contactId,
        title: candidate.title,
        description: candidate.description,
        dueAt,
        status: "OPEN",
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
      },
    });

    createdTasks.push({
      id: task.id,
      title: task.title,
      dueAt: task.dueAt ? task.dueAt.toISOString() : null,
      dueDateYmd: candidate.dueDateYmd,
    });
  }

  return createdTasks;
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

function validateTitleField(title, errors, fieldName = "title") {
  if (title === undefined || title === null) {
    return;
  }

  if (typeof title !== "string") {
    errors.push({ field: fieldName, message: `${fieldName} must be a string` });
    return;
  }

  if (title.length > INTERACTION_TITLE_MAX_LENGTH) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must not exceed ${INTERACTION_TITLE_MAX_LENGTH} characters`,
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
  validateTitleField(body.title, errors);

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
  validateTitleField(body.title, errors);

  return errors;
}

async function resolveAdvisorId(req) {
  if (req?.authUser?.id && typeof req.authUser.id === "string") {
    return req.authUser.id;
  }

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
    title: interaction.title || null,
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
    const advisorId = await resolveAdvisorId(req);
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
    const advisorId = await resolveAdvisorId(req);
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
      const advisorId = await resolveAdvisorId(req);
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

      const summaryText = String(req.body.summaryText || "").trim();
      const generatedAt =
        parseOptionalIsoDate(req.body.generatedAt, "generatedAt", []) ||
        new Date();

      const taskCandidates = await buildTaskCandidatesFromSummary({
        summaryText,
        generatedAt,
      });

      const autoCreatedTasks = await createTasksFromCandidates({
        contactId: updated.contactId,
        candidates: taskCandidates,
      });

      setInteractionObservation(res, "link-summary", {
        advisorId,
        contactId: updated.contactId,
        interactionId: updated.id,
      });

      res.status(200).json({
        item: mapInteraction(updated),
        autoCreatedTasks,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/:interactionId/summary-link", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorId(req);
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
      const advisorId = await resolveAdvisorId(req);
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
          title: normalizeOptionalString(req.body.title),
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
      const advisorId = await resolveAdvisorId(req);
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
          title:
            req.body.title !== undefined
              ? normalizeOptionalString(req.body.title)
              : undefined,
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
    const advisorId = await resolveAdvisorId(req);
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
