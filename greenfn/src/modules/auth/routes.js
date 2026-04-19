const express = require("express");
const bcrypt = require("bcryptjs");
const { validateBody, requiredString } = require("../../middleware/validate");
const { issueAccessToken } = require("../../lib/jwtAuth");
const { requireAuth } = require("../../middleware/requireAuth");
const { AUTH_LOGIN_EMAIL, AUTH_LOGIN_PASSWORD } = require("../../config/env");
const prisma = require("../../lib/prisma");
const { provisionUser } = require("../../lib/provisionUser");

const router = express.Router();

function validateLogin(body) {
  const errors = [];
  requiredString(body.email, "email", errors);
  requiredString(body.password, "password", errors);
  return errors;
}

function validateSignup(body) {
  const errors = [];
  requiredString(body.name, "name", errors);
  requiredString(body.email, "email", errors);
  requiredString(body.password, "password", errors);

  const email = String(body.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: "email", message: "email must be valid" });
  }

  const password = String(body.password || "");
  if (password && password.length < 8) {
    errors.push({
      field: "password",
      message: "password must be at least 8 characters",
    });
  }

  return errors;
}

async function resolveAdvisorForLogin(email, includePasswordHash = false) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  try {
    const advisorByEmail = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        ...(includePasswordHash ? { passwordHash: true } : {}),
      },
    });

    if (advisorByEmail) {
      return {
        id: advisorByEmail.id,
        email: advisorByEmail.email,
        name: advisorByEmail.name || "GreenFN Advisor",
        ...(includePasswordHash
          ? { passwordHash: advisorByEmail.passwordHash || null }
          : {}),
      };
    }

    return null;
  } catch (_error) {
    return null;
  }
}

async function ensureAdvisorForEnvLogin(email) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  const existingAdvisor = await resolveAdvisorForLogin(normalizedEmail);
  if (existingAdvisor?.id) {
    return existingAdvisor;
  }

  const createdAdvisor = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: "GreenFN Advisor",
    },
    select: { id: true, email: true, name: true },
  });

  await provisionUser(createdAdvisor.id);

  return {
    id: createdAdvisor.id,
    email: createdAdvisor.email,
    name: createdAdvisor.name || "GreenFN Advisor",
  };
}

async function issueTokenForAdvisor(advisor) {
  const accessToken = issueAccessToken(advisor);
  return {
    accessToken,
    user: {
      id: advisor.id,
      email: advisor.email,
      name: advisor.name || "GreenFN Advisor",
    },
    tokenType: "Bearer",
  };
}

router.get("/", (_req, res) => {
  res.json({ module: "auth", status: "ready" });
});

router.post("/login", validateBody(validateLogin), async (req, res, next) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    const advisorForEmail = await resolveAdvisorForLogin(email, true);

    if (advisorForEmail?.id && advisorForEmail.passwordHash) {
      const isPasswordValid = await bcrypt.compare(
        password,
        advisorForEmail.passwordHash,
      );
      if (!isPasswordValid) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }

      res.json(
        await issueTokenForAdvisor({
          id: advisorForEmail.id,
          email: advisorForEmail.email,
          name: advisorForEmail.name,
        }),
      );
      return;
    }

    if (
      email === AUTH_LOGIN_EMAIL.toLowerCase() &&
      password === AUTH_LOGIN_PASSWORD
    ) {
      const advisor = advisorForEmail?.id
        ? {
            id: advisorForEmail.id,
            email: advisorForEmail.email,
            name: advisorForEmail.name,
          }
        : await ensureAdvisorForEnvLogin(email);
      res.json(await issueTokenForAdvisor(advisor));
      return;
    }

    res.status(401).json({ message: "Invalid credentials" });
  } catch (error) {
    next(error);
  }
});

router.post("/signup", validateBody(validateSignup), async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingUser) {
      res.status(409).json({ message: "Email is already in use" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    await provisionUser(createdUser.id);

    res.status(201).json(await issueTokenForAdvisor(createdUser));
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    res.json({ user: req.authUser });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, (_req, res) => {
  res.status(204).send();
});

module.exports = router;
