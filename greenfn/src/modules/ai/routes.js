const express = require("express");
const { validateBody, requiredString } = require("../../middleware/validate");
const { httpError } = require("../../utils/httpError");
const { createAIService } = require("./service");
const { getAIMetricsSnapshot, logAIEvent } = require("./logging");
const prisma = require("../../lib/prisma");
const {
  AI_TIMEOUT_MS,
  AI_RATE_LIMIT_WINDOW_MS,
  AI_RATE_LIMIT_MAX_REQUESTS,
} = require("../../config/env");

const router = express.Router();
const aiService = createAIService({ timeoutMs: AI_TIMEOUT_MS });
const AI_SUMMARY_MARKER = "greenfn-ai-summary-v1";
const SUMMARY_RETENTION_DAYS = 365;
const TASK_EXTRACTION_LIMIT = 5;
const SUMMARY_NOTE_PREVIEW_MAX_CHARS = 220;
const aiRequestWindowStore = new Map();

const SUPPORTED_SUMMARY_SOURCE_MODES = new Set([
  "structured",
  "pasted-summary",
  "unstructured",
  "chat-transcript",
  "notes",
]);

function normalizeSourceMode(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "notes";
  }

  return value.trim().toLowerCase();
}

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallbackValue;
  }

  return parsed;
}

function getClientKey(req) {
  if (typeof req.ip === "string" && req.ip.trim().length > 0) {
    return req.ip.trim();
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return "unknown";
}

function cleanupExpiredRateLimitEntries(now) {
  for (const [key, entry] of aiRequestWindowStore.entries()) {
    if (entry.expiresAt <= now) {
      aiRequestWindowStore.delete(key);
    }
  }
}

function enforceAiRateLimit(req, _res, next) {
  const now = Date.now();
  cleanupExpiredRateLimitEntries(now);

  const clientKey = getClientKey(req);
  const existingWindow = aiRequestWindowStore.get(clientKey);

  if (!existingWindow || existingWindow.expiresAt <= now) {
    aiRequestWindowStore.set(clientKey, {
      count: 1,
      expiresAt: now + AI_RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }

  if (existingWindow.count >= AI_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existingWindow.expiresAt - now) / 1000),
    );

    return next(
      httpError(429, "AI rate limit exceeded. Please retry shortly.", {
        rateLimitWindowMs: AI_RATE_LIMIT_WINDOW_MS,
        maxRequests: AI_RATE_LIMIT_MAX_REQUESTS,
        retryAfterSeconds,
      }),
    );
  }

  existingWindow.count += 1;
  aiRequestWindowStore.set(clientKey, existingWindow);
  return next();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value, fieldName, errors) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    errors.push({ field: fieldName, message: `${fieldName} must be a string` });
    return null;
  }

  return value.trim();
}

function buildSummaryInputFromRequest(body) {
  const sourceMode = normalizeSourceMode(body.sourceMode);

  if (!SUPPORTED_SUMMARY_SOURCE_MODES.has(sourceMode)) {
    throw httpError(400, "Unsupported sourceMode for summary generation", {
      sourceMode,
      supportedSourceModes: Array.from(SUPPORTED_SUMMARY_SOURCE_MODES),
    });
  }

  if (sourceMode === "structured") {
    if (!isPlainObject(body.structuredInput)) {
      throw httpError(
        400,
        "structuredInput is required when sourceMode is structured",
      );
    }

    const structuredErrors = [];
    requiredString(
      body.structuredInput.keyPoints,
      "structuredInput.keyPoints",
      structuredErrors,
    );
    requiredString(
      body.structuredInput.clientNeeds,
      "structuredInput.clientNeeds",
      structuredErrors,
    );
    requiredString(
      body.structuredInput.nextSteps,
      "structuredInput.nextSteps",
      structuredErrors,
    );
    optionalString(
      body.structuredInput.followUpAction,
      "structuredInput.followUpAction",
      structuredErrors,
    );

    if (structuredErrors.length > 0) {
      throw httpError(400, "Validation failed", structuredErrors);
    }

    const followUpAction = String(
      body.structuredInput.followUpAction || "",
    ).trim();
    const input = [
      "Key points discussed:",
      String(body.structuredInput.keyPoints).trim(),
      "",
      "Client needs/concerns:",
      String(body.structuredInput.clientNeeds).trim(),
      "",
      "Next steps agreed:",
      String(body.structuredInput.nextSteps).trim(),
      followUpAction ? `Advisor follow-up action: ${followUpAction}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      sourceMode,
      input,
    };
  }

  if (typeof body.input !== "string" || body.input.trim().length === 0) {
    throw httpError(
      400,
      "input is required for non-structured summary generation",
    );
  }

  return {
    sourceMode,
    input: body.input.trim(),
  };
}

function validateGenerateSummary(body) {
  const errors = [];
  requiredString(body.contactId, "contactId", errors);

  if (
    body.interactionId !== undefined &&
    body.interactionId !== null &&
    typeof body.interactionId !== "string"
  ) {
    errors.push({
      field: "interactionId",
      message: "interactionId must be a string",
    });
  }

  const sourceMode = normalizeSourceMode(body.sourceMode);

  if (!SUPPORTED_SUMMARY_SOURCE_MODES.has(sourceMode)) {
    errors.push({
      field: "sourceMode",
      message: `sourceMode must be one of: ${Array.from(SUPPORTED_SUMMARY_SOURCE_MODES).join(", ")}`,
    });
  }

  if (sourceMode === "structured") {
    if (!isPlainObject(body.structuredInput)) {
      errors.push({
        field: "structuredInput",
        message: "structuredInput is required when sourceMode is structured",
      });
      return errors;
    }

    requiredString(
      body.structuredInput.keyPoints,
      "structuredInput.keyPoints",
      errors,
    );
    requiredString(
      body.structuredInput.clientNeeds,
      "structuredInput.clientNeeds",
      errors,
    );
    requiredString(
      body.structuredInput.nextSteps,
      "structuredInput.nextSteps",
      errors,
    );

    if (
      body.structuredInput.followUpAction !== undefined &&
      body.structuredInput.followUpAction !== null &&
      typeof body.structuredInput.followUpAction !== "string"
    ) {
      errors.push({
        field: "structuredInput.followUpAction",
        message: "structuredInput.followUpAction must be a string",
      });
    }

    return errors;
  }

  requiredString(body.input, "input", errors);
  return errors;
}

async function assertContactExists(contactId) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, advisorId: true },
  });

  if (!contact) {
    throw httpError(404, "Requested record was not found", {
      resource: "contact",
      contactId,
    });
  }

  return contact;
}

function buildStoredSummaryLink({
  summaryText,
  model,
  sourceMode,
  generatedAt,
}) {
  return JSON.stringify({
    marker: AI_SUMMARY_MARKER,
    summaryText,
    model: model || null,
    sourceMode: sourceMode || null,
    generatedAt: generatedAt.toISOString(),
  });
}

function normalizeInputMode(sourceMode) {
  if (typeof sourceMode !== "string" || sourceMode.trim().length === 0) {
    return null;
  }

  return sourceMode.trim().toLowerCase();
}

function buildModelMetadata(summaryResult) {
  return {
    model: summaryResult.model || null,
    provider: summaryResult.provider || "google",
    usage: summaryResult.usage || null,
    degraded: Boolean(summaryResult.degraded),
    fallbackReason: summaryResult.fallbackReason || null,
  };
}

function buildRetentionUntil(generatedAt) {
  const retentionUntil = new Date(generatedAt);
  retentionUntil.setDate(retentionUntil.getDate() + SUMMARY_RETENTION_DAYS);
  return retentionUntil;
}

function takeFirstMatches(input, matcher, limit = 2) {
  const lines = String(input || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const matches = lines.filter((line) => matcher.test(line));
  return matches.slice(0, limit);
}

function formatBulletSection(title, lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return `${title}\n- Not specified`;
  }

  return [title, ...lines.map((line) => `- ${line}`)].join("\n");
}

function buildLocalFallbackSummary({ input, sourceMode }) {
  const normalizedInput = String(input || "").trim();
  const inputLines = normalizedInput
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const primaryContext = inputLines.slice(0, 2);
  const keyFacts = inputLines.slice(0, 3);
  const clientNeeds = takeFirstMatches(
    normalizedInput,
    /(need|needs|concern|prefer|preference|want|wants|goal|priority)/i,
  );
  const decisions = takeFirstMatches(
    normalizedInput,
    /(decid|agreed|confirm|approved|selected|chose|choice)/i,
  );
  const nextSteps = takeFirstMatches(
    normalizedInput,
    /(next step|follow up|follow-up|schedule|send|review|call|meeting|action)/i,
  );

  return [
    formatBulletSection("Context", [
      `Source mode: ${sourceMode}`,
      ...primaryContext,
    ]),
    formatBulletSection("Key Facts", keyFacts),
    formatBulletSection("Client Needs", clientNeeds),
    formatBulletSection("Decisions", decisions),
    formatBulletSection("Next Steps", nextSteps),
  ].join("\n\n");
}

function isAiProviderUnavailable(error) {
  const statusCode = Number(error?.statusCode || 0);
  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) {
    return true;
  }

  if (error?.name === "AbortError") {
    return true;
  }

  return false;
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSummaryPreviewNote(summaryText) {
  const normalized = normalizeWhitespace(summaryText);

  if (!normalized) {
    return "AI Summary";
  }

  if (normalized.length <= SUMMARY_NOTE_PREVIEW_MAX_CHARS) {
    return `AI Summary: ${normalized}`;
  }

  return `AI Summary: ${normalized.slice(0, SUMMARY_NOTE_PREVIEW_MAX_CHARS - 1)}...`;
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

async function buildTaskCandidatesFromSummary({
  summaryText,
  generatedAt,
  timezone,
}) {
  const baseDate = new Date(generatedAt);

  try {
    const extractionResult = await aiService.extractTasksFromSummary({
      summaryText,
      todayYmd: buildYmd(baseDate),
      timezone,
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

async function linkSummaryToInteraction({
  interactionId,
  contactId,
  advisorId,
  summaryRecordId,
  summaryText,
  model,
  sourceMode,
  generatedAt,
}) {
  const summaryLink = buildStoredSummaryLink({
    summaryText,
    model,
    sourceMode,
    generatedAt,
  });

  if (!interactionId) {
    const createdInteraction = await prisma.interaction.create({
      data: {
        contactId,
        advisorId,
        type: "NOTE",
        occurredAt: generatedAt,
        title: "AI Summary",
        notes: buildSummaryPreviewNote(summaryText),
        aiSummaryRecordId: summaryRecordId,
        aiSummary: summaryLink,
      },
      select: { id: true },
    });

    return {
      linked: true,
      interactionId: createdInteraction.id,
      interactionCreated: true,
    };
  }

  const updated = await prisma.interaction.updateMany({
    where: { id: interactionId, contactId },
    data: {
      aiSummaryRecordId: summaryRecordId,
      aiSummary: summaryLink,
    },
  });

  if (updated.count === 0) {
    throw httpError(
      404,
      "Requested record was not found or does not belong to contact",
      {
        resource: "interaction",
        interactionId,
        contactId,
      },
    );
  }

  return {
    linked: true,
    interactionId,
    interactionCreated: false,
  };
}

router.get("/", (_req, res) => {
  res.json({ module: "ai", status: "ready" });
});

router.get("/metrics", (req, res) => {
  const windowMinutes = parsePositiveInt(req.query.windowMinutes, 60 * 24);
  const windowMs = windowMinutes * 60 * 1000;

  res.status(200).json({
    metrics: getAIMetricsSnapshot({ windowMs }),
  });
});

router.post(
  "/summaries/preview",
  enforceAiRateLimit,
  validateBody(validateGenerateSummary),
  async (req, res, next) => {
    try {
      const contactId = req.body.contactId.trim();
      await assertContactExists(contactId);

      const { sourceMode, input } = buildSummaryInputFromRequest(req.body);

      let summaryResult;
      try {
        summaryResult = await aiService.generateSummary({
          contactId,
          sourceMode,
          input,
        });
      } catch (error) {
        if (!isAiProviderUnavailable(error)) {
          throw error;
        }

        summaryResult = {
          text: buildLocalFallbackSummary({ input, sourceMode }),
          model: "local-fallback-v1",
          provider: "local-fallback",
          degraded: true,
          fallbackReason: "ai-provider-unavailable",
          usage: {
            estimatedInputTokens: 0,
            estimatedOutputTokens: 0,
            estimatedCostUsd: 0,
          },
        };

        logAIEvent("warn", "summary_provider_unavailable_local_fallback", {
          provider: "google",
          model: null,
          path: "generateSummary.preview",
          contactId,
          sourceMode,
          inputText: input,
          outputText: summaryResult.text,
          statusCode: error?.statusCode || 503,
          errorMessage:
            error?.message || "AI provider unavailable; used local fallback",
          usage: summaryResult.usage,
        });
      }

      const generatedAt = new Date();

      res.status(200).json({
        summary: {
          text: summaryResult.text,
          model: summaryResult.model,
          modelMetadata: buildModelMetadata(summaryResult),
          sourceMode,
          usage: summaryResult.usage,
          degraded: Boolean(summaryResult.degraded),
          generatedAt: generatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/summaries",
  enforceAiRateLimit,
  validateBody(validateGenerateSummary),
  async (req, res, next) => {
    try {
      const contactId = req.body.contactId.trim();
      const contact = await assertContactExists(contactId);

      const { sourceMode, input } = buildSummaryInputFromRequest(req.body);

      let summaryResult;
      try {
        summaryResult = await aiService.generateSummary({
          contactId,
          sourceMode,
          input,
        });
      } catch (error) {
        if (!isAiProviderUnavailable(error)) {
          throw error;
        }

        summaryResult = {
          text: buildLocalFallbackSummary({ input, sourceMode }),
          model: "local-fallback-v1",
          provider: "local-fallback",
          degraded: true,
          fallbackReason: "ai-provider-unavailable",
          usage: {
            estimatedInputTokens: 0,
            estimatedOutputTokens: 0,
            estimatedCostUsd: 0,
          },
        };

        logAIEvent("warn", "summary_provider_unavailable_local_fallback", {
          provider: "google",
          model: null,
          path: "generateSummary",
          contactId,
          sourceMode,
          inputText: input,
          outputText: summaryResult.text,
          statusCode: error?.statusCode || 503,
          errorMessage:
            error?.message || "AI provider unavailable; used local fallback",
          usage: summaryResult.usage,
        });
      }

      const generatedAt = new Date();
      const retentionUntil = buildRetentionUntil(generatedAt);
      const summaryRecord = await prisma.aiSummary.create({
        data: {
          contactId,
          summaryText: summaryResult.text,
          inputMode: normalizeInputMode(sourceMode),
          model: summaryResult.model || null,
          modelMetadata: buildModelMetadata(summaryResult),
          sourceMode,
          generatedAt,
          retentionUntil,
        },
        select: {
          id: true,
        },
      });

      const requestedInteractionId =
        typeof req.body.interactionId === "string" &&
        req.body.interactionId.trim().length > 0
          ? req.body.interactionId.trim()
          : null;

      const interactionLink = await linkSummaryToInteraction({
        interactionId: requestedInteractionId,
        contactId,
        advisorId: contact.advisorId,
        summaryRecordId: summaryRecord.id,
        summaryText: summaryResult.text,
        model: summaryResult.model || null,
        sourceMode,
        generatedAt,
      });

      const taskCandidates = await buildTaskCandidatesFromSummary({
        summaryText: summaryResult.text,
        generatedAt,
        timezone: "Asia/Singapore",
      });
      const createdTasks = await createTasksFromCandidates({
        contactId,
        candidates: taskCandidates,
      });

      res.status(200).json({
        summary: {
          id: summaryRecord.id,
          text: summaryResult.text,
          model: summaryResult.model,
          modelMetadata: buildModelMetadata(summaryResult),
          inputMode: normalizeInputMode(sourceMode),
          sourceMode,
          usage: summaryResult.usage,
          degraded: Boolean(summaryResult.degraded),
          generatedAt: generatedAt.toISOString(),
          retentionUntil: retentionUntil.toISOString(),
          deletedAt: null,
          interactionLinked: interactionLink.linked,
          interactionId: interactionLink.interactionId,
          interactionCreated: interactionLink.interactionCreated,
          taskCandidatesFound: taskCandidates.length,
          tasksCreatedCount: createdTasks.length,
          tasksCreated: createdTasks,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
