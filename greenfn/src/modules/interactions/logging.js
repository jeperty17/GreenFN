const crypto = require("crypto");

function toSafeHash(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function toStatusLevel(statusCode) {
  if (statusCode >= 500) {
    return "error";
  }

  if (statusCode >= 400) {
    return "warn";
  }

  return "info";
}

function sanitizeMetadata(metadata = {}) {
  const {
    method,
    path,
    operation,
    endpointType,
    statusCode,
    durationMs,
    itemCount,
    total,
    page,
    pageSize,
    sortDirection,
    advisorId,
    contactId,
    interactionId,
  } = metadata;

  return {
    method: method || null,
    path: path || null,
    operation: operation || null,
    endpointType: endpointType || null,
    statusCode: Number.isInteger(statusCode) ? statusCode : null,
    durationMs: Number.isFinite(durationMs)
      ? Number(durationMs.toFixed(1))
      : null,
    itemCount: Number.isInteger(itemCount) ? itemCount : null,
    total: Number.isInteger(total) ? total : null,
    page: Number.isInteger(page) ? page : null,
    pageSize: Number.isInteger(pageSize) ? pageSize : null,
    sortDirection: typeof sortDirection === "string" ? sortDirection : null,
    advisorIdHash: toSafeHash(advisorId),
    contactIdHash: toSafeHash(contactId),
    interactionIdHash: toSafeHash(interactionId),
  };
}

function logInteractionEvent(level, event, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...sanitizeMetadata(metadata),
  };

  if (level === "error") {
    console.error("[interactions]", JSON.stringify(entry));
    return;
  }

  if (level === "warn") {
    console.warn("[interactions]", JSON.stringify(entry));
    return;
  }

  console.info("[interactions]", JSON.stringify(entry));
}

module.exports = {
  logInteractionEvent,
  toStatusLevel,
};
