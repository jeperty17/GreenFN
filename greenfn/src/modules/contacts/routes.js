const express = require("express");
const { validateBody, requiredString } = require("../../middleware/validate");
const prisma = require("../../lib/prisma");
const { httpError } = require("../../utils/httpError");

const router = express.Router();

const CONTACT_TYPES = new Set(["LEAD", "CLIENT"]);
const CONTACT_META_MARKER = "greenfn-contact-meta-v1";

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
    type: contact.type,
    birthday: contact.birthday
      ? contact.birthday.toISOString().slice(0, 10)
      : null,
    priorities: meta.priorities,
    portfolioSummary: meta.portfolioSummary,
    isStarred: contact.isStarred,
    tags: Array.isArray(contact.tags)
      ? contact.tags.map((contactTag) => contactTag.tag)
      : [],
    updatedAt: contact.updatedAt,
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

function validateOptionalStringField(body, fieldName, errors) {
  if (body[fieldName] === undefined || body[fieldName] === null) {
    return;
  }

  if (typeof body[fieldName] !== "string") {
    errors.push({ field: fieldName, message: `${fieldName} must be a string` });
  }
}

async function resolveAdvisorId() {
  const advisor = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (!advisor) {
    throw httpError(
      500,
      "Unable to resolve advisor context for contact creation",
    );
  }

  return advisor.id;
}

function validateCreateContact(body) {
  const errors = [];
  requiredString(body.fullName, "fullName", errors);
  validateType(body.type, errors);
  validateOptionalStringField(body, "email", errors);
  validateOptionalStringField(body, "phone", errors);
  validateOptionalStringField(body, "source", errors);
  validateOptionalStringField(body, "birthday", errors);
  validateOptionalStringField(body, "priorities", errors);
  validateOptionalStringField(body, "portfolioSummary", errors);

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
  validateOptionalStringField(body, "birthday", errors);
  validateOptionalStringField(body, "priorities", errors);
  validateOptionalStringField(body, "portfolioSummary", errors);

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

async function resolveContactForWrite(contactId) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, advisorId: true, notes: true },
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
    const search = String(req.query.search || "").trim();
    const source = String(req.query.source || "").trim();
    const tag = String(req.query.tag || "").trim();
    const type = String(req.query.type || "")
      .trim()
      .toUpperCase();
    const starred = parseBoolean(req.query.starred);

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 100);
    const skip = (page - 1) * pageSize;

    const andFilters = [];

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
        include: {
          tags: {
            include: {
              tag: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    res.json({
      items: contacts.map((contact) => ({
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
    const advisorId = await resolveAdvisorId();
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

    const advisorId = await resolveAdvisorId();
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
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.contactId },
      include: {
        tags: {
          include: {
            tag: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!contact) {
      throw httpError(404, "Requested record was not found", {
        resource: "contact",
        contactId: req.params.contactId,
      });
    }

    res.json({ item: mapContact(contact) });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  validateBody(validateCreateContact),
  async (req, res, next) => {
    try {
      const advisorId = await resolveAdvisorId();
      const type = String(req.body.type || "LEAD")
        .trim()
        .toUpperCase();
      const fullName = req.body.fullName.trim();
      const birthday = parseBirthday(req.body.birthday, "birthday", []);

      if (!fullName) {
        throw httpError(400, "Validation failed", [
          { field: "fullName", message: "fullName is required" },
        ]);
      }

      const contact = await prisma.contact.create({
        data: {
          advisorId,
          fullName,
          type: CONTACT_TYPES.has(type) ? type : "LEAD",
          email: normalizeOptionalString(req.body.email),
          phone: normalizeOptionalString(req.body.phone),
          source: normalizeOptionalString(req.body.source),
          birthday,
          isStarred: req.body.isStarred === true,
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
        include: {
          tags: {
            include: {
              tag: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      res.status(201).json({ item: mapContact(contact) });
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
      const existingContact = await prisma.contact.findUnique({
        where: { id: req.params.contactId },
        select: { id: true, advisorId: true, notes: true },
      });

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
        updatedPayload.type = String(req.body.type).trim().toUpperCase();
      }

      if (req.body.email !== undefined) {
        updatedPayload.email = normalizeOptionalString(req.body.email);
      }

      if (req.body.phone !== undefined) {
        updatedPayload.phone = normalizeOptionalString(req.body.phone);
      }

      if (req.body.source !== undefined) {
        updatedPayload.source = normalizeOptionalString(req.body.source);
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
        updatedPayload.notes = buildNotesFromMeta(
          {
            priorities: req.body.priorities,
            portfolioSummary: req.body.portfolioSummary,
          },
          existingContact.notes,
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
        include: {
          tags: {
            include: {
              tag: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      res.json({ item: mapContact(contact) });
    } catch (error) {
      next(error);
    }
  },
);

router.post("/:contactId/tags", async (req, res, next) => {
  try {
    const contact = await resolveContactForWrite(req.params.contactId);
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
      include: {
        tags: {
          include: {
            tag: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    res.json({ item: mapContact(updatedContact) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:contactId/tags/:tagId", async (req, res, next) => {
  try {
    const contact = await resolveContactForWrite(req.params.contactId);

    await prisma.contactTag.deleteMany({
      where: {
        contactId: contact.id,
        tagId: req.params.tagId,
      },
    });

    const updatedContact = await prisma.contact.findUnique({
      where: { id: contact.id },
      include: {
        tags: {
          include: {
            tag: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    res.json({ item: mapContact(updatedContact) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:contactId/starred", async (req, res, next) => {
  try {
    if (typeof req.body?.isStarred !== "boolean") {
      throw httpError(400, "Validation failed", [
        { field: "isStarred", message: "isStarred must be a boolean" },
      ]);
    }

    await resolveContactForWrite(req.params.contactId);

    const contact = await prisma.contact.update({
      where: { id: req.params.contactId },
      data: { isStarred: req.body.isStarred },
      include: {
        tags: {
          include: {
            tag: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    res.json({ item: mapContact(contact) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:contactId", async (req, res, next) => {
  try {
    await resolveContactForWrite(req.params.contactId);

    await prisma.contact.delete({
      where: { id: req.params.contactId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
