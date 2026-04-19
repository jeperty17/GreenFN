// Provisions default pipeline stages and tags for a newly created user.
// Called after signup and on first env-login user creation.
"use strict";

const prisma = require("./prisma");

const DEFAULT_STAGES = [
  { name: "New", order: 1 },
  { name: "Contacted", order: 2 },
  { name: "Booked", order: 3 },
  { name: "No-show", order: 4 },
  { name: "In Progress", order: 5 },
  { name: "Closed Won", order: 6 },
  { name: "Closed Lost", order: 7 },
  { name: "Servicing", order: 8 },
];

const DEFAULT_TAGS = [
  "High Priority",
  "Follow Up",
  "Referral",
  "Warm Lead",
  "Cold Lead",
  "VIP",
];

/**
 * Seeds default pipeline stages and tags for a given advisorId.
 * Uses skipDuplicates so it is safe to call on an existing user.
 */
async function provisionUser(advisorId) {
  await prisma.pipelineStage.createMany({
    data: DEFAULT_STAGES.map((s) => ({ ...s, advisorId })),
    skipDuplicates: true,
  });

  await prisma.tag.createMany({
    data: DEFAULT_TAGS.map((name) => ({ name, advisorId })),
    skipDuplicates: true,
  });
}

module.exports = { provisionUser, DEFAULT_STAGES, DEFAULT_TAGS };
