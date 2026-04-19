const express = require("express");
const { validateBody, requiredString } = require("../../middleware/validate");
const prisma = require("../../lib/prisma");
const { httpError } = require("../../utils/httpError");
const { logContactsRequestMetrics } = require("./logging");

const router = express.Router();

const CONTACT_TYPES = new Set(["LEAD", "CLIENT"]);
const SOURCE_CATEGORIES = new Set([
  "REFERRAL",
  "COLD_CALL",
  "SOCIAL_MEDIA",
  "EVENT",
  "WEBSITE",
  "OTHER",
]);
const CONTACT_META_MARKER = "greenfn-contact-meta-v1";
const DEFAULT_ADVISOR_ID = "seed-user-001";

router.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logContactsRequestMetrics(req, res, durationMs);
  });

  next();
});

function parsePositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(String(value || ""), 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return fallbackValue;
  }

  return parsed;
}

function parseBoolean(value) {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  return undefined;
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

function normalizeSourceCategory(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalizedValue) {
    return null;
  }

  return SOURCE_CATEGORIES.has(normalizedValue) ? normalizedValue : undefined;
}

function inferSourceCategoryFromSource(source) {
  const normalizedSource = normalizeOptionalString(source);

  if (!normalizedSource) {
    return null;
  }

  const loweredSource = normalizedSource.toLowerCase();

  if (loweredSource.includes("referral")) {
    return "REFERRAL";
  }

  if (loweredSource.includes("cold")) {
    return "COLD_CALL";
  }

  if (
    loweredSource.includes("instagram") ||
    loweredSource.includes("telegram") ||
    loweredSource.includes("whatsapp") ||
    loweredSource.includes("social")
  ) {
    return "SOCIAL_MEDIA";
  }

  if (loweredSource.includes("event") || loweredSource.includes("seminar")) {
    return "EVENT";
  }

  if (loweredSource.includes("website") || loweredSource.includes("web")) {
    return "WEBSITE";
  }

  return "OTHER";
}

function normalizePolicyMetadata(value, errors, fieldName = "policyMetadata") {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  errors.push({ field: fieldName, message: `${fieldName} must be an object` });
  return undefined;
}

function parseBirthday(value, fieldName, errors) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
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

function parseContactMetaFromNotes(notes) {
  if (!notes || typeof notes !== "string") {
    return { priorities: null, portfolioSummary: null };
  }

  try {
    const parsed = JSON.parse(notes);

    if (parsed?.marker !== CONTACT_META_MARKER) {
      return { priorities: null, portfolioSummary: null };
    }

    return {
      priorities: normalizeOptionalString(parsed.priorities),
      portfolioSummary: normalizeOptionalString(parsed.portfolioSummary),
    };
  } catch (_error) {
    return { priorities: null, portfolioSummary: null };
  }
}

function buildNotesFromMeta(partialMeta, currentNotes) {
  const currentMeta = parseContactMetaFromNotes(currentNotes);
  const priorities =
    partialMeta.priorities !== undefined
      ? normalizeOptionalString(partialMeta.priorities)
      : currentMeta.priorities;
  const portfolioSummary =
    partialMeta.portfolioSummary !== undefined
      ? normalizeOptionalString(partialMeta.portfolioSummary)
      : currentMeta.portfolioSummary;

  if (!priorities && !portfolioSummary) {
    return null;
  }

  return JSON.stringify({
    marker: CONTACT_META_MARKER,
    priorities,
    portfolioSummary,
  });
}

function mapContact(contact) {
  const meta = parseContactMetaFromNotes(contact.notes);

  return {
    id: contact.id,
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    source: contact.source,
    sourceCategory: contact.sourceCategory || null,
    type: contact.type,
    birthday: contact.birthday
      ? contact.birthday.toISOString().slice(0, 10)
      : null,
    priorities: contact.lifePriorities || meta.priorities,
    portfolioSummary: contact.portfolioSummary || meta.portfolioSummary,
    policyMetadata: contact.policyMetadata || null,
    isStarred: contact.isStarred,
    tags: Array.isArray(contact.tags)
      ? contact.tags.map((contactTag) => contactTag.tag)
      : [],
    stageName: contact.stage?.name || null,
    updatedAt: contact.updatedAt,
  };
}

function mapPolicy(policy) {
  return {
    id: policy.id,
    contactId: policy.contactId,
    provider: policy.provider || null,
    policyType: policy.policyType || null,
    details: policy.details || null,
    startDate: policy.startDate
      ? policy.startDate.toISOString().slice(0, 10)
      : null,
    endDate: policy.endDate ? policy.endDate.toISOString().slice(0, 10) : null,
    summaryPdfUrl: policy.summaryPdfUrl || null,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

function validateType(type, errors, fieldName = "type") {
  if (type === undefined || type === null || type === "") {
    return;
  }

  if (typeof type !== "string") {
    errors.push({ field: fieldName, message: `${fieldName} must be a string` });
    return;
  }

  if (!CONTACT_TYPES.has(type.trim().toUpperCase())) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be LEAD or CLIENT`,
    });
  }
}

function validateSourceCategory(
  sourceCategory,
  errors,
  fieldName = "sourceCategory",
) {
  if (
    sourceCategory === undefined ||
    sourceCategory === null ||
    sourceCategory === ""
  ) {
    return;
  }

  if (typeof sourceCategory !== "string") {
    errors.push({ field: fieldName, message: `${fieldName} must be a string` });
    return;
  }

  if (!normalizeSourceCategory(sourceCategory)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be one of ${Array.from(SOURCE_CATEGORIES).join(", ")}`,
    });
  }
}

function validateOptionalStringField(body, fieldName, errors) {
  if (body[fieldName] === undefined || body[fieldName] === null) {
    return;
  }

  if (typeof body[fieldName] !== "string") {
    errors.push({ field: fieldName, message: `${fieldName} must be a string` });
  }
}

async function resolveAdvisorIdFromRequest(req) {
  if (req.authUser?.id) {
    const advisorByAuthId = await prisma.user.findUnique({
      where: { id: req.authUser.id },
      select: { id: true },
    });

    if (advisorByAuthId?.id) {
      return advisorByAuthId.id;
    }

    const authEmail = normalizeOptionalString(req.authUser.email);
    if (authEmail) {
      const advisorByEmail = await prisma.user.findFirst({
        where: {
          email: {
            equals: authEmail,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (advisorByEmail?.id) {
        return advisorByEmail.id;
      }
    }

    const createdAdvisor = await prisma.user.create({
      data: {
        id: req.authUser.id,
        email: authEmail || `${req.authUser.id}@greenfn.local`,
        name: normalizeOptionalString(req.authUser.name) || "GreenFN Advisor",
      },
      select: { id: true },
    });

    return createdAdvisor.id;
  }

  const advisor = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return advisor?.id || DEFAULT_ADVISOR_ID;
}

async function resolveDefaultLeadStageId(advisorId) {
  const orderZeroStage = await prisma.pipelineStage.findFirst({
    where: {
      advisorId,
      order: 0,
    },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  if (orderZeroStage) {
    return orderZeroStage.id;
  }

  const newStage = await prisma.pipelineStage.findFirst({
    where: {
      advisorId,
      name: {
        equals: "New",
        mode: "insensitive",
      },
    },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  if (newStage) {
    return newStage.id;
  }

  const firstStage = await prisma.pipelineStage.findFirst({
    where: { advisorId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  return firstStage?.id || null;
}

async function resolveDefaultClientStageId(advisorId) {
  const servicingStage = await prisma.pipelineStage.findFirst({
    where: {
      advisorId,
      name: {
        equals: "Servicing",
        mode: "insensitive",
      },
    },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  if (servicingStage) {
    return servicingStage.id;
  }

  const firstStage = await prisma.pipelineStage.findFirst({
    where: { advisorId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  return firstStage?.id || null;
}

function validateCreateContact(body) {
  const errors = [];
  requiredString(body.fullName, "fullName", errors);
  validateType(body.type, errors);
  validateOptionalStringField(body, "email", errors);
  validateOptionalStringField(body, "phone", errors);
  validateOptionalStringField(body, "source", errors);
  validateSourceCategory(body.sourceCategory, errors);
  validateOptionalStringField(body, "birthday", errors);
  validateOptionalStringField(body, "priorities", errors);
  validateOptionalStringField(body, "portfolioSummary", errors);
  normalizePolicyMetadata(body.policyMetadata, errors);

  if (body.isStarred !== undefined && typeof body.isStarred !== "boolean") {
    errors.push({ field: "isStarred", message: "isStarred must be a boolean" });
  }

  if (body.tagNames !== undefined) {
    if (!Array.isArray(body.tagNames)) {
      errors.push({
        field: "tagNames",
        message: "tagNames must be an array of strings",
      });
    } else if (body.tagNames.some((tagName) => typeof tagName !== "string")) {
      errors.push({
        field: "tagNames",
        message: "tagNames must contain only strings",
      });
    }
  }

  parseBirthday(body.birthday, "birthday", errors);

  return errors;
}

function validateUpdateContact(body) {
  const errors = [];

  if (!body || Object.keys(body).length === 0) {
    errors.push({ field: "body", message: "request body cannot be empty" });
  }

  if (body.fullName !== undefined && typeof body.fullName !== "string") {
    errors.push({ field: "fullName", message: "fullName must be a string" });
  }

  validateType(body.type, errors);
  validateOptionalStringField(body, "email", errors);
  validateOptionalStringField(body, "phone", errors);
  validateOptionalStringField(body, "source", errors);
  validateSourceCategory(body.sourceCategory, errors);
  validateOptionalStringField(body, "birthday", errors);
  validateOptionalStringField(body, "priorities", errors);
  validateOptionalStringField(body, "portfolioSummary", errors);
  normalizePolicyMetadata(body.policyMetadata, errors);

  if (body.isStarred !== undefined && typeof body.isStarred !== "boolean") {
    errors.push({ field: "isStarred", message: "isStarred must be a boolean" });
  }

  if (body.tagNames !== undefined) {
    if (!Array.isArray(body.tagNames)) {
      errors.push({
        field: "tagNames",
        message: "tagNames must be an array of strings",
      });
    } else if (body.tagNames.some((tagName) => typeof tagName !== "string")) {
      errors.push({
        field: "tagNames",
        message: "tagNames must contain only strings",
      });
    }
  }

  parseBirthday(body.birthday, "birthday", errors);

  return errors;
}

function normalizeTagNames(tagNames) {
  if (!Array.isArray(tagNames)) {
    return [];
  }

  const names = tagNames
    .map((tagName) => (typeof tagName === "string" ? tagName.trim() : ""))
    .filter(Boolean);

  return [...new Set(names)];
}

async function resolveTagIdsByNames(advisorId, tagNames) {
  const normalizedTagNames = normalizeTagNames(tagNames);

  if (normalizedTagNames.length === 0) {
    return [];
  }

  const resolvedTagIds = [];

  for (const tagName of normalizedTagNames) {
    const tag = await prisma.tag.upsert({
      where: {
        advisorId_name: {
          advisorId,
          name: tagName,
        },
      },
      update: {},
      create: {
        advisorId,
        name: tagName,
      },
      select: { id: true },
    });

    resolvedTagIds.push(tag.id);
  }

  return resolvedTagIds;
}

async function loadContactTagsByContactIds(contactIds) {
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return new Map();
  }

  const contactTags = await prisma.contactTag.findMany({
    where: {
      contactId: { in: contactIds },
    },
    select: {
      contactId: true,
      tagId: true,
    },
  });

  const tagIds = [
    ...new Set(contactTags.map((contactTag) => contactTag.tagId)),
  ];
  const tags =
    tagIds.length > 0
      ? await prisma.tag.findMany({
          where: { id: { in: tagIds } },
          select: { id: true, name: true },
        })
      : [];
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const byContactId = new Map();

  for (const contactTag of contactTags) {
    const tag = tagMap.get(contactTag.tagId);
    if (!tag) {
      continue;
    }

    const list = byContactId.get(contactTag.contactId) || [];
    list.push({ tag });
    byContactId.set(contactTag.contactId, list);
  }

  return byContactId;
}

async function withTagsForContacts(contacts) {
  const tagMapByContact = await loadContactTagsByContactIds(
    contacts.map((contact) => contact.id),
  );

  return contacts.map((contact) => ({
    ...contact,
    tags: tagMapByContact.get(contact.id) || [],
  }));
}

async function withTagsForContact(contact) {
  const [enriched] = await withTagsForContacts(contact ? [contact] : []);
  return enriched || null;
}

async function resolveContactForWrite(contactId, advisorId) {
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      advisorId,
    },
    select: { id: true, advisorId: true, type: true, notes: true },
  });

  if (!contact) {
    throw httpError(404, "Requested record was not found", {
      resource: "contact",
      contactId,
    });
  }

  return contact;
}

router.get("/", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorIdFromRequest(req);
    const search = String(req.query.search || "").trim();
    const source = String(req.query.source || "").trim();
    const sourceCategory = normalizeSourceCategory(req.query.sourceCategory);
    const tag = String(req.query.tag || "").trim();
    const type = String(req.query.type || "")
      .trim()
      .toUpperCase();
    const starred = parseBoolean(req.query.starred);

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 100);
    const skip = (page - 1) * pageSize;

    const andFilters = [{ advisorId }];

    if (search) {
      andFilters.push({
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (CONTACT_TYPES.has(type)) {
      andFilters.push({ type });
    }

    if (source) {
      andFilters.push({ source: { contains: source, mode: "insensitive" } });
    }

    if (sourceCategory) {
      andFilters.push({ sourceCategory });
    }

    if (tag) {
      andFilters.push({
        tags: {
          some: {
            tag: {
              name: { contains: tag, mode: "insensitive" },
            },
          },
        },
      });
    }

    if (starred !== undefined) {
      andFilters.push({ isStarred: starred });
    }

    const where = andFilters.length > 0 ? { AND: andFilters } : {};

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.contact.count({ where }),
    ]);

    const contactsWithTags = await withTagsForContacts(contacts);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    res.json({
      items: contactsWithTags.map((contact) => ({
        ...mapContact(contact),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      filters: {
        search,
        type: CONTACT_TYPES.has(type) ? type : null,
        source,
        sourceCategory,
        tag,
        starred,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/tags", async (_req, res, next) => {
  try {
    const advisorId = await resolveAdvisorIdFromRequest(_req);
    const tags = await prisma.tag.findMany({
      where: { advisorId },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    });

    res.json({ items: tags });
  } catch (error) {
    next(error);
  }
});

router.post("/tags", async (req, res, next) => {
  try {
    if (
      typeof req.body?.name !== "string" ||
      req.body.name.trim().length === 0
    ) {
      throw httpError(400, "Validation failed", [
        { field: "name", message: "name is required" },
      ]);
    }

    const advisorId = await resolveAdvisorIdFromRequest(req);
    const name = req.body.name.trim();

    const tag = await prisma.tag.upsert({
      where: {
        advisorId_name: {
          advisorId,
          name,
        },
      },
      update: {},
      create: {
        advisorId,
        name,
      },
      select: { id: true, name: true },
    });

    res.status(201).json({ item: tag });
  } catch (error) {
    next(error);
  }
});

router.get("/:contactId", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorIdFromRequest(req);
    const contact = await prisma.contact.findFirst({
      where: {
        id: req.params.contactId,
        advisorId,
      },
      include: { stage: true },
    });

    if (!contact) {
      throw httpError(404, "Requested record was not found", {
        resource: "contact",
        contactId: req.params.contactId,
      });
    }
    const contactWithTags = await withTagsForContact(contact);

    res.json({ item: mapContact(contactWithTags) });
  } catch (error) {
    next(error);
  }
});

router.get("/:contactId/policies", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorIdFromRequest(req);
    const contact = await resolveContactForWrite(
      req.params.contactId,
      advisorId,
    );
    const policies = await prisma.policy.findMany({
      where: { contactId: contact.id },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });

    res.json({ items: policies.map(mapPolicy) });
  } catch (error) {
    next(error);
  }
});

router.post("/:contactId/policies", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorIdFromRequest(req);
    const contact = await resolveContactForWrite(
      req.params.contactId,
      advisorId,
    );
    const validationErrors = [];
    const policyType =
      req.body?.policyType === undefined
        ? null
        : normalizeOptionalString(req.body.policyType);
    const startDate = parseBirthday(
      req.body?.startDate,
      "startDate",
      validationErrors,
    );
    const endDate = parseBirthday(
      req.body?.endDate,
      "endDate",
      validationErrors,
    );

    validateOptionalStringField(req.body || {}, "provider", validationErrors);
    validateOptionalStringField(req.body || {}, "policyType", validationErrors);
    validateOptionalStringField(req.body || {}, "details", validationErrors);
    validateOptionalStringField(
      req.body || {},
      "summaryPdfUrl",
      validationErrors,
    );

    if (!policyType) {
      validationErrors.push({
        field: "policyType",
        message: "policyType is required",
      });
    }

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      validationErrors.push({
        field: "endDate",
        message: "endDate cannot be earlier than startDate",
      });
    }

    if (validationErrors.length > 0) {
      throw httpError(400, "Validation failed", validationErrors);
    }

    const policy = await prisma.policy.create({
      data: {
        contactId: contact.id,
        provider: normalizeOptionalString(req.body?.provider),
        policyType,
        details: normalizeOptionalString(req.body?.details),
        startDate,
        endDate,
        summaryPdfUrl: normalizeOptionalString(req.body?.summaryPdfUrl),
      },
    });

    res.status(201).json({ item: mapPolicy(policy) });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  validateBody(validateCreateContact),
  async (req, res, next) => {
    try {
      const advisorId = await resolveAdvisorIdFromRequest(req);
      const type = String(req.body.type || "LEAD")
        .trim()
        .toUpperCase();
      const normalizedType = CONTACT_TYPES.has(type) ? type : "LEAD";
      const routedStageId =
        normalizedType === "CLIENT"
          ? await resolveDefaultClientStageId(advisorId)
          : await resolveDefaultLeadStageId(advisorId);
      const fullName = req.body.fullName.trim();
      const birthday = parseBirthday(req.body.birthday, "birthday", []);
      const source = normalizeOptionalString(req.body.source);
      const sourceCategory =
        normalizeSourceCategory(req.body.sourceCategory) ||
        inferSourceCategoryFromSource(source);
      const policyMetadata = normalizePolicyMetadata(
        req.body.policyMetadata,
        [],
      );

      if (!fullName) {
        throw httpError(400, "Validation failed", [
          { field: "fullName", message: "fullName is required" },
        ]);
      }

      const contact = await prisma.contact.create({
        data: {
          advisorId,
          fullName,
          type: normalizedType,
          stageId: routedStageId,
          email: normalizeOptionalString(req.body.email),
          phone: normalizeOptionalString(req.body.phone),
          source,
          sourceCategory,
          birthday,
          isStarred: req.body.isStarred === true,
          lifePriorities: normalizeOptionalString(req.body.priorities),
          portfolioSummary: normalizeOptionalString(req.body.portfolioSummary),
          policyMetadata,
          notes: buildNotesFromMeta(
            {
              priorities: req.body.priorities,
              portfolioSummary: req.body.portfolioSummary,
            },
            null,
          ),
          tags: {
            create: (
              await resolveTagIdsByNames(advisorId, req.body.tagNames)
            ).map((tagId) => ({
              tag: { connect: { id: tagId } },
            })),
          },
        },
      });

      const contactWithTags = await withTagsForContact(contact);

      res.status(201).json({ item: mapContact(contactWithTags) });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:contactId",
  validateBody(validateUpdateContact),
  async (req, res, next) => {
    try {
      const advisorId = await resolveAdvisorIdFromRequest(req);
      const existingContact = await resolveContactForWrite(
        req.params.contactId,
        advisorId,
      );

      if (!existingContact) {
        throw httpError(404, "Requested record was not found", {
          resource: "contact",
          contactId: req.params.contactId,
        });
      }

      const updatedPayload = {};

      if (req.body.fullName !== undefined) {
        const fullName = req.body.fullName.trim();

        if (!fullName) {
          throw httpError(400, "Validation failed", [
            { field: "fullName", message: "fullName cannot be empty" },
          ]);
        }

        updatedPayload.fullName = fullName;
      }

      if (req.body.type !== undefined) {
        const normalizedType = String(req.body.type).trim().toUpperCase();
        updatedPayload.type = normalizedType;

        if (normalizedType !== existingContact.type) {
          updatedPayload.stageId =
            normalizedType === "CLIENT"
              ? await resolveDefaultClientStageId(advisorId)
              : await resolveDefaultLeadStageId(advisorId);
        }
      }

      if (req.body.email !== undefined) {
        updatedPayload.email = normalizeOptionalString(req.body.email);
      }

      if (req.body.phone !== undefined) {
        updatedPayload.phone = normalizeOptionalString(req.body.phone);
      }

      if (req.body.source !== undefined) {
        const source = normalizeOptionalString(req.body.source);
        updatedPayload.source = source;

        if (req.body.sourceCategory === undefined) {
          updatedPayload.sourceCategory = inferSourceCategoryFromSource(source);
        }
      }

      if (req.body.sourceCategory !== undefined) {
        updatedPayload.sourceCategory = normalizeSourceCategory(
          req.body.sourceCategory,
        );
      }

      if (req.body.birthday !== undefined) {
        updatedPayload.birthday = parseBirthday(
          req.body.birthday,
          "birthday",
          [],
        );
      }

      if (req.body.isStarred !== undefined) {
        updatedPayload.isStarred = req.body.isStarred === true;
      }

      if (
        req.body.priorities !== undefined ||
        req.body.portfolioSummary !== undefined
      ) {
        if (req.body.priorities !== undefined) {
          updatedPayload.lifePriorities = normalizeOptionalString(
            req.body.priorities,
          );
        }

        if (req.body.portfolioSummary !== undefined) {
          updatedPayload.portfolioSummary = normalizeOptionalString(
            req.body.portfolioSummary,
          );
        }

        updatedPayload.notes = buildNotesFromMeta(
          {
            priorities: req.body.priorities,
            portfolioSummary: req.body.portfolioSummary,
          },
          existingContact.notes,
        );
      }

      if (req.body.policyMetadata !== undefined) {
        updatedPayload.policyMetadata = normalizePolicyMetadata(
          req.body.policyMetadata,
          [],
        );
      }

      if (req.body.tagNames !== undefined) {
        const tagIds = await resolveTagIdsByNames(
          existingContact.advisorId,
          req.body.tagNames,
        );

        updatedPayload.tags = {
          deleteMany: {},
          create: tagIds.map((tagId) => ({
            tag: { connect: { id: tagId } },
          })),
        };
      }

      const contact = await prisma.contact.update({
        where: { id: req.params.contactId },
        data: updatedPayload,
      });

      const contactWithTags = await withTagsForContact(contact);

      res.json({ item: mapContact(contactWithTags) });
    } catch (error) {
      next(error);
    }
  },
);

router.post("/:contactId/tags", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorIdFromRequest(req);
    const contact = await resolveContactForWrite(
      req.params.contactId,
      advisorId,
    );
    const incomingTagIds = Array.isArray(req.body?.tagIds)
      ? req.body.tagIds.filter(
          (tagId) => typeof tagId === "string" && tagId.trim().length > 0,
        )
      : [];
    const createdTagIds = await resolveTagIdsByNames(
      contact.advisorId,
      req.body?.tagNames,
    );
    const tagIds = [...new Set([...incomingTagIds, ...createdTagIds])];

    if (tagIds.length === 0) {
      throw httpError(400, "Validation failed", [
        {
          field: "tagIds",
          message: "Provide at least one tagId or tagNames entry",
        },
      ]);
    }

    await prisma.contactTag.createMany({
      data: tagIds.map((tagId) => ({
        contactId: contact.id,
        tagId,
      })),
      skipDuplicates: true,
    });

    const updatedContact = await prisma.contact.findUnique({
      where: { id: contact.id },
    });
    const updatedContactWithTags = await withTagsForContact(updatedContact);

    res.json({ item: mapContact(updatedContactWithTags) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:contactId/tags/:tagId", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorIdFromRequest(req);
    const contact = await resolveContactForWrite(
      req.params.contactId,
      advisorId,
    );

    await prisma.contactTag.deleteMany({
      where: {
        contactId: contact.id,
        tagId: req.params.tagId,
      },
    });

    const updatedContact = await prisma.contact.findUnique({
      where: { id: contact.id },
    });
    const updatedContactWithTags = await withTagsForContact(updatedContact);

    res.json({ item: mapContact(updatedContactWithTags) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:contactId/starred", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorIdFromRequest(req);
    if (typeof req.body?.isStarred !== "boolean") {
      throw httpError(400, "Validation failed", [
        { field: "isStarred", message: "isStarred must be a boolean" },
      ]);
    }

    await resolveContactForWrite(req.params.contactId, advisorId);

    const contact = await prisma.contact.update({
      where: { id: req.params.contactId },
      data: { isStarred: req.body.isStarred },
    });

    const contactWithTags = await withTagsForContact(contact);

    res.json({ item: mapContact(contactWithTags) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:contactId", async (req, res, next) => {
  try {
    const advisorId = await resolveAdvisorIdFromRequest(req);
    await resolveContactForWrite(req.params.contactId, advisorId);

    await prisma.contact.delete({
      where: { id: req.params.contactId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
