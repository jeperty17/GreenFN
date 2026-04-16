const { httpError } = require("../../utils/httpError");
const {
  AI_PROVIDER,
  AI_PRIMARY_MODEL,
  AI_FALLBACK_MODEL,
  requireGeminiApiKey,
} = require("../../config/env");
const { logAIEvent } = require("./logging");

// Gemini native generateContent endpoint — model name goes in the path
const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

// Gemini 2.5 Flash and Flash-Lite are effectively free tier — cost set to 0
const MODEL_PRICING_PER_1K = {
  "gemini-2.5-flash": { input: 0, output: 0 },
  "gemini-2.5-flash-lite": { input: 0, output: 0 },
};

const defaultOptions = {
  provider: AI_PROVIDER,
  primaryModel: AI_PRIMARY_MODEL,
  fallbackModel: AI_FALLBACK_MODEL,
  maxRetries: 2,
  retryBackoffMs: 350,
  maxInputChars: 12000,
  maxInputTokens: 3200,
  maxOutputTokens: 1200,
  maxSummaryOutputChars: 4000,
  maxDraftOutputChars: 1400,
  timeoutMs: 12000,
};

const BLOCKED_CONTENT_PATTERNS = [
  {
    code: "self-harm-intent",
    regex:
      /\b(kill myself|suicide plan|end my life|harm myself|self\s*harm)\b/i,
    message: "Input appears to contain self-harm intent content.",
  },
  {
    code: "violent-threat",
    regex:
      /\b(kill (him|her|them)|shoot (him|her|them)|bomb (them|it)|attack (them|him|her))\b/i,
    message: "Input appears to contain violent threat content.",
  },
  {
    code: "sexual-minors",
    regex: /\b(child porn|sexual (minor|child)|underage sex|minor\s+sexual)\b/i,
    message: "Input appears to contain disallowed sexual-minors content.",
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateTokenCount(text) {
  if (!text || typeof text !== "string") {
    return 0;
  }

  return Math.ceil(text.length / 4);
}

function estimateCostUsd({ model, inputTokens, outputTokens }) {
  const pricing = MODEL_PRICING_PER_1K[model];

  if (!pricing) {
    return null;
  }

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;

  return Number((inputCost + outputCost).toFixed(6));
}

function isRetryableStatus(statusCode) {
  return (
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 429 ||
    statusCode >= 500
  );
}

const SUMMARY_PROMPT_TEMPLATES = {
  structured: {
    guidance:
      "Input is pre-structured from advisor fields. Preserve factual details and convert into concise recall bullets.",
    emphasis:
      "Prioritize explicit next steps and advisor commitments. Do not infer missing data.",
  },
  "pasted-summary": {
    guidance:
      "Input is a pasted meeting summary. Compress and de-duplicate details while preserving intent and decisions.",
    emphasis:
      "Extract concrete outcomes and action owners. Keep wording short and scan-friendly.",
  },
  unstructured: {
    guidance:
      "Input is free-form notes. Organize fragmented thoughts into a coherent recall summary without inventing facts.",
    emphasis:
      "Normalize into clear sections and capture implied decisions only if explicitly stated.",
  },
  "chat-transcript": {
    guidance:
      "Input is a chat transcript. Distill key discussion turns, requests, confirmations, and follow-up expectations.",
    emphasis:
      "Identify who requested what and any agreed timelines. Exclude conversational filler.",
  },
  notes: {
    guidance:
      "Input is advisor notes. Produce concise recall output suitable for follow-up and timeline history.",
    emphasis:
      "Highlight client needs, decisions, and next steps with minimal prose.",
  },
};

function getSummaryPromptTemplate(sourceMode) {
  return SUMMARY_PROMPT_TEMPLATES[sourceMode] || SUMMARY_PROMPT_TEMPLATES.notes;
}

function buildSummaryOutputContract() {
  return [
    "Output contract:",
    "- Use exactly these sections in order:",
    "  1) Context — who the client is, what pipeline stage they are at, and the nature of this interaction.",
    "  2) Key Facts — anything the FA would need to remember for future reference or for the next pipeline stage.",
    "  3) Client Needs — specific concerns, goals, or pain points the client raised.",
    "  4) Decisions — anything agreed upon or committed to by either party during this interaction.",
    "  5) Next Steps — what needs to happen next, including timing or deadlines where mentioned.",
    "- Each section must have 2-5 bullet points.",
    "- Each bullet point must be a complete, informative sentence — not a fragment.",
    "- Keep total output under 400 words.",
    "- Do not include Markdown tables, code fences, or JSON.",
    '- If a section genuinely has no relevant information, write a single bullet: "Not specified." Do not pad with filler.',
  ].join("\n");
}

function buildSummaryMessages({ contactId, input, sourceMode = "notes" }) {
  const template = getSummaryPromptTemplate(sourceMode);
  const outputContract = buildSummaryOutputContract();

  return [
    {
      role: "system",
      content: [
        "You summarize financial-advisor interactions for CRM recall.",
        "Use factual, neutral language and keep responses concise.",
        outputContract,
      ].join("\n\n"),
    },
    {
      role: "user",
      content: [
        `Contact ID: ${contactId}`,
        `Source Mode: ${sourceMode}`,
        `Template Guidance: ${template.guidance}`,
        `Template Emphasis: ${template.emphasis}`,
        "",
        "Input:",
        input,
      ].join("\n"),
    },
  ];
}

function buildDraftMessages({ contactName, objective, context }) {
  return [
    {
      role: "system",
      content:
        "You draft short, professional advisor follow-up messages. Keep tone warm, specific, and action-oriented. Avoid legal or financial guarantees.",
    },
    {
      role: "user",
      content: `Contact Name: ${contactName}\nObjective: ${objective}\nContext:\n${context}`,
    },
  ];
}


// Convert OpenAI-style messages to Gemini native format.
// System messages become system_instruction; user/assistant become contents.
function toGeminiRequest({ messages, maxOutputTokens }) {
  const systemMsg = messages.find((m) => m.role === "system");
  const turns = messages.filter((m) => m.role !== "system");

  const body = {
    contents: turns.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens,
    },
  };

  if (systemMsg) {
    body.system_instruction = { parts: [{ text: systemMsg.content }] };
  }

  return body;
}

async function callGemini({
  apiKey,
  model,
  messages,
  maxOutputTokens,
  timeoutMs,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Native Gemini generateContent endpoint — API key goes in the query string
  const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(toGeminiRequest({ messages, maxOutputTokens })),
    });

    if (!response.ok) {
      let details = null;
      try {
        details = await response.json();
      } catch {
        details = null;
      }

      const error = httpError(response.status, "AI provider request failed", {
        provider: "google",
        model,
        statusCode: response.status,
        details,
      });
      error.retryable = isRetryableStatus(response.status);
      throw error;
    }

    const payload = await response.json();
    // Extract text from Gemini native response format
    return payload?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } finally {
    clearTimeout(timeout);
  }
}

async function withRetry(operation, { maxRetries, retryBackoffMs }) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxRetries || !error.retryable) {
        throw error;
      }

      const backoff = retryBackoffMs * Math.pow(2, attempt);
      await sleep(backoff);
      attempt += 1;
    }
  }

  throw httpError(500, "Unexpected retry flow termination");
}

function validateInputText(input, maxInputChars) {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw httpError(400, "AI input text is required");
  }

  if (input.length > maxInputChars) {
    throw httpError(413, "AI input exceeds configured size limit", {
      maxInputChars,
      inputLength: input.length,
    });
  }
}

function validateInputTokenLimit(input, maxInputTokens) {
  const inputTokens = estimateTokenCount(input);

  if (inputTokens > maxInputTokens) {
    throw httpError(413, "AI input exceeds configured token limit", {
      maxInputTokens,
      estimatedInputTokens: inputTokens,
    });
  }

  return inputTokens;
}

function validateContentSafety(text, source) {
  const matched = BLOCKED_CONTENT_PATTERNS.find((rule) =>
    rule.regex.test(text || ""),
  );

  if (!matched) {
    return;
  }

  throw httpError(422, "Content safety policy blocked this request", {
    source,
    code: matched.code,
    message: matched.message,
  });
}

function validateOutputLength(text, maxChars, outputType) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw httpError(502, `AI ${outputType} response was empty`);
  }

  if (text.length > maxChars) {
    throw httpError(
      502,
      `AI ${outputType} response exceeded configured length`,
      {
        maxChars,
        outputChars: text.length,
      },
    );
  }
}

function createAIService(config = {}) {
  const options = { ...defaultOptions, ...config };

  if (options.provider !== "google" && options.provider !== "gemini") {
    throw httpError(400, "Unsupported AI provider configured", {
      provider: options.provider,
    });
  }

  async function generateSummary({ contactId, input, sourceMode = "notes" }) {
    validateInputText(input, options.maxInputChars);
    validateContentSafety(input, "summary-input");
    const startedAt = Date.now();

    const messages = buildSummaryMessages({ contactId, input, sourceMode });
    const inputTokens = validateInputTokenLimit(
      messages.map((message) => message.content).join("\n"),
      options.maxInputTokens,
    );
    const apiKey = requireGeminiApiKey();

    logAIEvent("info", "summary_request_started", {
      provider: options.provider,
      model: options.primaryModel,
      path: "generateSummary",
      contactId,
      sourceMode,
      inputText: input,
    });

    const runForModel = async (model) => {
      const text = await withRetry(
        () =>
          callGemini({
            apiKey,
            model,
            messages,
            maxOutputTokens: options.maxOutputTokens,
            timeoutMs: options.timeoutMs,
          }),
        {
          maxRetries: options.maxRetries,
          retryBackoffMs: options.retryBackoffMs,
        },
      );

      validateOutputLength(text, options.maxSummaryOutputChars, "summary");
      validateContentSafety(text, "summary-output");

      const outputTokens = estimateTokenCount(text);
      return {
        text,
        model,
        usage: {
          estimatedInputTokens: inputTokens,
          estimatedOutputTokens: outputTokens,
          estimatedCostUsd: estimateCostUsd({
            model,
            inputTokens,
            outputTokens,
          }),
        },
      };
    };

    try {
      const result = await runForModel(options.primaryModel);
      logAIEvent("info", "summary_request_succeeded", {
        provider: options.provider,
        model: result.model,
        path: "generateSummary",
        contactId,
        sourceMode,
        inputText: input,
        outputText: result.text,
        usage: result.usage,
        durationMs: Date.now() - startedAt,
      });

      return result;
    } catch (primaryError) {
      if (
        !options.fallbackModel ||
        options.fallbackModel === options.primaryModel
      ) {
        logAIEvent("error", "summary_request_failed", {
          provider: options.provider,
          model: options.primaryModel,
          path: "generateSummary",
          contactId,
          sourceMode,
          inputText: input,
          statusCode: primaryError?.statusCode || null,
          errorMessage: primaryError?.message || "AI summary request failed",
          errorDetails: primaryError?.details || null,
          durationMs: Date.now() - startedAt,
        });
        throw primaryError;
      }

      logAIEvent("warn", "summary_primary_failed_using_fallback", {
        provider: options.provider,
        model: options.primaryModel,
        path: "generateSummary",
        contactId,
        sourceMode,
        inputText: input,
        statusCode: primaryError?.statusCode || null,
        errorMessage: primaryError?.message || "Primary model failed",
        errorDetails: primaryError?.details || null,
      });

      try {
        const fallbackResult = await runForModel(options.fallbackModel);
        logAIEvent("info", "summary_request_succeeded", {
          provider: options.provider,
          model: fallbackResult.model,
          path: "generateSummary",
          contactId,
          sourceMode,
          inputText: input,
          outputText: fallbackResult.text,
          usage: fallbackResult.usage,
          durationMs: Date.now() - startedAt,
        });

        return fallbackResult;
      } catch (fallbackError) {
        logAIEvent("error", "summary_request_failed", {
          provider: options.provider,
          model: options.fallbackModel,
          path: "generateSummary",
          contactId,
          sourceMode,
          inputText: input,
          statusCode: fallbackError?.statusCode || null,
          errorMessage: fallbackError?.message || "AI summary request failed",
          errorDetails: fallbackError?.details || null,
          durationMs: Date.now() - startedAt,
        });
        throw fallbackError;
      }
    }
  }

  async function draftMessage({ contactName, objective, context }) {
    validateInputText(context, options.maxInputChars);
    validateContentSafety(context, "draft-input");
    const startedAt = Date.now();

    logAIEvent("info", "draft_request_started", {
      provider: options.provider,
      model: options.primaryModel,
      path: "draftMessage",
      contactName,
      objective,
      inputText: context,
    });

    const messages = buildDraftMessages({ contactName, objective, context });
    const inputTokens = validateInputTokenLimit(
      messages.map((message) => message.content).join("\n"),
      options.maxInputTokens,
    );
    const apiKey = requireGeminiApiKey();

    let text;
    try {
      text = await withRetry(
        () =>
          callGemini({
            apiKey,
            model: options.primaryModel,
            messages,
            maxOutputTokens: Math.min(options.maxOutputTokens, 320),
            timeoutMs: options.timeoutMs,
          }),
        {
          maxRetries: options.maxRetries,
          retryBackoffMs: options.retryBackoffMs,
        },
      );
    } catch (error) {
      logAIEvent("error", "draft_request_failed", {
        provider: options.provider,
        model: options.primaryModel,
        path: "draftMessage",
        contactName,
        objective,
        inputText: context,
        statusCode: error?.statusCode || null,
        errorMessage: error?.message || "AI draft request failed",
        errorDetails: error?.details || null,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }

    validateOutputLength(text, options.maxDraftOutputChars, "draft");
    validateContentSafety(text, "draft-output");

    const outputTokens = estimateTokenCount(text);

    const result = {
      text,
      model: options.primaryModel,
      usage: {
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        estimatedCostUsd: estimateCostUsd({
          model: options.primaryModel,
          inputTokens,
          outputTokens,
        }),
      },
    };

    logAIEvent("info", "draft_request_succeeded", {
      provider: options.provider,
      model: result.model,
      path: "draftMessage",
      contactName,
      objective,
      inputText: context,
      outputText: result.text,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
    });

    return result;
  }

  return {
    buildSummaryMessages,
    buildDraftMessages,
    generateSummary,
    draftMessage,
    estimateTokenCount,
    estimateCostUsd,
    validateContentSafety,
    validateInputTokenLimit,
    validateOutputLength,
  };
}

module.exports = {
  createAIService,
  buildSummaryMessages,
  buildDraftMessages,
  estimateTokenCount,
  estimateCostUsd,
};
