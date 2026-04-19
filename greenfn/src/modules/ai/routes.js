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
    select: { id: true },
  });

  if (!contact) {
    throw httpError(404, "Requested record was not found", {
      resource: "contact",
      contactId,
    });
  }
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
    provider: summaryResult.provider || "openai",
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

function getSafeSummaryErrorMessage(error, fallbackMessage) {
  const statusCode = Number(error?.statusCode || 0);

  if (statusCode === 400) {
    return "Please check the summary input and try again.";
  }

  if (statusCode === 401 || statusCode === 403) {
    return "You are not allowed to generate a summary right now.";
  }

  if (statusCode === 404) {
    return "The selected contact or record could not be found.";
  }

  if (statusCode === 413) {
    return "The input is too long. Please shorten it and try again.";
  }

  if (statusCode === 422) {
    return "The input was blocked by a safety check. Please revise it and try again.";
  }

  if (statusCode === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }

  if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
    return "AI summary generation is temporarily unavailable. Please try again later.";
  }

  return fallbackMessage;
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
    `- Source mode: ${sourceMode}`,
    ...primaryContext.slice(0, 2).map((line) => `- ${line}`),
    ...keyFacts.slice(0, 2).map((line) => `- Key fact: ${line}`),
    ...clientNeeds.slice(0, 2).map((line) => `- Client need: ${line}`),
    ...decisions.slice(0, 2).map((line) => `- Decision: ${line}`),
    ...nextSteps.slice(0, 3).map((line) => `- Next step: ${line}`),
  ].join("\n");
}

function isAiProviderUnavailable(error) {
  const statusCode = Number(error?.statusCode || 0);
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details?.error?.message || "").toLowerCase();

  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) {
    return true;
  }

  if (error?.name === "AbortError") {
    return true;
  }

  if (
    message.includes("openai_api_key") ||
    message.includes("api key") ||
    details.includes("temporar") ||
    details.includes("unavailable") ||
    details.includes("overloaded")
  ) {
    return true;
  }

  return false;
}

async function linkSummaryToInteraction({
  interactionId,
  contactId,
  summaryRecordId,
  summaryText,
  model,
  sourceMode,
  generatedAt,
}) {
  if (!interactionId) {
    return false;
  }

  const updated = await prisma.interaction.updateMany({
    where: { id: interactionId, contactId },
    data: {
      aiSummaryRecordId: summaryRecordId,
      aiSummary: buildStoredSummaryLink({
        summaryText,
        model,
        sourceMode,
        generatedAt,
      }),
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

  return true;
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
  "/summaries",
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
          provider: "openai",
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

      const linkedToInteraction = await linkSummaryToInteraction({
        interactionId:
          typeof req.body.interactionId === "string"
            ? req.body.interactionId.trim()
            : null,
        contactId,
        summaryRecordId: summaryRecord.id,
        summaryText: summaryResult.text,
        model: summaryResult.model || null,
        sourceMode,
        generatedAt,
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
          interactionLinked: linkedToInteraction,
        },
      });
    } catch (error) {
      if (error?.statusCode) {
        const safeMessage = getSafeSummaryErrorMessage(
          error,
          "Failed to generate summary.",
        );

        if (safeMessage !== error.message) {
          error = httpError(error.statusCode, safeMessage, error.details);
        }
      }

      next(error);
    }
  },
);

module.exports = router;
