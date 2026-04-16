const crypto = require("crypto");

const METRICS_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_METRICS_EVENTS = 5000;
const HOURLY_BUCKET_MS = 60 * 60 * 1000;
const aiMetricsEvents = [];

function toSafeHash(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function sanitizeMetadata(metadata = {}) {
  const {
    inputText,
    outputText,
    contactId,
    contactName,
    objective,
    sourceMode,
    model,
    provider,
    statusCode,
    durationMs,
    usage,
    errorMessage,
    path,
    ...rest
  } = metadata;

  return {
    ...rest,
    provider: provider || null,
    model: model || null,
    path: path || null,
    sourceMode: sourceMode || null,
    statusCode: statusCode || null,
    durationMs: Number.isFinite(durationMs)
      ? Number(durationMs.toFixed(1))
      : null,
    contactIdHash: toSafeHash(contactId),
    contactNameHash: toSafeHash(contactName),
    objectiveHash: toSafeHash(objective),
    inputChars: typeof inputText === "string" ? inputText.length : 0,
    outputChars: typeof outputText === "string" ? outputText.length : 0,
    usage: usage || null,
    errorMessage: typeof errorMessage === "string" ? errorMessage : null,
  };
}

function pruneMetrics(now = Date.now()) {
  const cutoff = now - METRICS_RETENTION_MS;

  while (
    aiMetricsEvents.length > 0 &&
    aiMetricsEvents[0].timestampMs < cutoff
  ) {
    aiMetricsEvents.shift();
  }

  if (aiMetricsEvents.length > MAX_METRICS_EVENTS) {
    aiMetricsEvents.splice(0, aiMetricsEvents.length - MAX_METRICS_EVENTS);
  }
}

function recordAIMetric(event, metadata = {}) {
  const entry = sanitizeMetadata(metadata);
  aiMetricsEvents.push({
    timestampMs: Date.now(),
    event,
    path: entry.path,
    model: entry.model,
    statusCode: entry.statusCode,
    durationMs: entry.durationMs,
    usage: entry.usage,
  });
  pruneMetrics();
}

function createAggregateShape() {
  return {
    requests: 0,
    successes: 0,
    failures: 0,
    estimatedCostUsd: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    totalDurationMs: 0,
    durationCount: 0,
    avgDurationMs: 0,
  };
}

function applyEventToAggregate(aggregate, event) {
  aggregate.requests += 1;

  if (event.event && event.event.includes("succeeded")) {
    aggregate.successes += 1;
  }

  if (event.event && event.event.includes("failed")) {
    aggregate.failures += 1;
  }

  const usage = event.usage || {};
  aggregate.estimatedCostUsd += Number(usage.estimatedCostUsd || 0);
  aggregate.estimatedInputTokens += Number(usage.estimatedInputTokens || 0);
  aggregate.estimatedOutputTokens += Number(usage.estimatedOutputTokens || 0);

  if (
    typeof event.durationMs === "number" &&
    Number.isFinite(event.durationMs)
  ) {
    aggregate.totalDurationMs += event.durationMs;
    aggregate.durationCount += 1;
  }
}

function finalizeAggregate(aggregate) {
  aggregate.estimatedCostUsd = Number(aggregate.estimatedCostUsd.toFixed(6));
  aggregate.avgDurationMs =
    aggregate.durationCount > 0
      ? Number((aggregate.totalDurationMs / aggregate.durationCount).toFixed(1))
      : 0;

  delete aggregate.totalDurationMs;
  delete aggregate.durationCount;

  return aggregate;
}

function getAIMetricsSnapshot({ windowMs = METRICS_RETENTION_MS } = {}) {
  const now = Date.now();
  pruneMetrics(now);
  const cutoff = now - windowMs;

  const events = aiMetricsEvents.filter((event) => event.timestampMs >= cutoff);
  const totals = createAggregateShape();
  const byModel = {};
  const byPath = {};

  const bucketCount = Math.max(1, Math.ceil(windowMs / HOURLY_BUCKET_MS));
  const series = Array.from({ length: bucketCount }, (_value, index) => ({
    bucketStart: new Date(
      now - (bucketCount - index) * HOURLY_BUCKET_MS,
    ).toISOString(),
    requests: 0,
    estimatedCostUsd: 0,
  }));

  for (const event of events) {
    applyEventToAggregate(totals, event);

    const modelKey = event.model || "unknown";
    if (!byModel[modelKey]) {
      byModel[modelKey] = createAggregateShape();
    }
    applyEventToAggregate(byModel[modelKey], event);

    const pathKey = event.path || "unknown";
    if (!byPath[pathKey]) {
      byPath[pathKey] = createAggregateShape();
    }
    applyEventToAggregate(byPath[pathKey], event);

    const bucketIndex = Math.floor(
      (event.timestampMs - cutoff) / HOURLY_BUCKET_MS,
    );
    if (bucketIndex >= 0 && bucketIndex < series.length) {
      series[bucketIndex].requests += 1;
      series[bucketIndex].estimatedCostUsd = Number(
        (
          series[bucketIndex].estimatedCostUsd +
          Number(event.usage?.estimatedCostUsd || 0)
        ).toFixed(6),
      );
    }
  }

  return {
    windowMs,
    generatedAt: new Date(now).toISOString(),
    totals: finalizeAggregate(totals),
    byModel: Object.fromEntries(
      Object.entries(byModel).map(([key, aggregate]) => [
        key,
        finalizeAggregate(aggregate),
      ]),
    ),
    byPath: Object.fromEntries(
      Object.entries(byPath).map(([key, aggregate]) => [
        key,
        finalizeAggregate(aggregate),
      ]),
    ),
    series,
  };
}

function logAIEvent(level, event, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...sanitizeMetadata(metadata),
  };

  recordAIMetric(event, metadata);

  if (level === "error") {
    console.error("[ai]", JSON.stringify(entry));
    return;
  }

  if (level === "warn") {
    console.warn("[ai]", JSON.stringify(entry));
    return;
  }

  console.info("[ai]", JSON.stringify(entry));
}

module.exports = {
  logAIEvent,
  sanitizeMetadata,
  getAIMetricsSnapshot,
};
