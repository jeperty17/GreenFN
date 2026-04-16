const express = require("express");
const { validateBody, requiredString } = require("../../middleware/validate");
const { issueAccessToken } = require("../../lib/jwtAuth");
const { requireAuth } = require("../../middleware/requireAuth");
const { AUTH_LOGIN_EMAIL, AUTH_LOGIN_PASSWORD } = require("../../config/env");
const prisma = require("../../lib/prisma");

const router = express.Router();

function validateLogin(body) {
  const errors = [];
  requiredString(body.email, "email", errors);
  requiredString(body.password, "password", errors);
  return errors;
}

async function resolveAdvisorForLogin(email) {
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
      select: { id: true, email: true, name: true },
    });

    if (advisorByEmail) {
      return {
        id: advisorByEmail.id,
        email: advisorByEmail.email,
        name: advisorByEmail.name || "GreenFN Advisor",
      };
    }

    const firstAdvisor = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true },
    });

    if (firstAdvisor) {
      return {
        id: firstAdvisor.id,
        email: firstAdvisor.email,
        name: firstAdvisor.name || "GreenFN Advisor",
      };
    }
  } catch (_error) {
    // Fall through to local-only fallback identity.
  }

  return {
    id: "local-auth-user",
    email: normalizedEmail || AUTH_LOGIN_EMAIL.toLowerCase(),
    name: "GreenFN Advisor",
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

    if (
      email !== AUTH_LOGIN_EMAIL.toLowerCase() ||
      password !== AUTH_LOGIN_PASSWORD
    ) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const advisor = await resolveAdvisorForLogin(email);

    const accessToken = issueAccessToken(advisor);

    res.json({
      accessToken,
      user: advisor,
      tokenType: "Bearer",
    });
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
