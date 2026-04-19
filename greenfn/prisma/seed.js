// Seeds the dev test advisor account with default pipeline stages and tags.
// Contacts, interactions, and tasks are NOT seeded — provisionUser handles
// stages/tags for real users on signup.
"use strict";

require("dotenv").config();

let PrismaClient;
try {
  ({ PrismaClient } = require("@prisma/client"));
} catch (error) {
  ({ PrismaClient } = require("../generated/prisma"));
}
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

// Seed bypasses the Prisma proxy and connects directly via pg adapter.
// DIRECT_URL must be reachable (port 5432).
const connectionString = (
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  ""
)
  .replace(/[?&]pgbouncer=true/gi, "")
  .replace(/\?$/, "");

const isLocalConnection = /localhost|127\.0\.0\.1/i.test(connectionString);

const pool = new Pool({
  connectionString,
  ...(isLocalConnection ? {} : { ssl: { rejectUnauthorized: false } }),
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ADVISOR_ID = "seed-user-001";
const ADVISOR_EMAIL = "advisor.seed@greenfn.local";
const ADVISOR_PASSWORD = process.env.AUTH_LOGIN_PASSWORD || "password123";

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

async function seed() {
  console.log("Starting seed...");
  const seedPasswordHash = await bcrypt.hash(ADVISOR_PASSWORD, 10);

  // ── Advisor user ───────────────────────────────────────────────────────
  const advisor = await prisma.user.upsert({
    where: { id: ADVISOR_ID },
    update: {
      email: ADVISOR_EMAIL,
      name: "Seed Advisor",
      passwordHash: seedPasswordHash,
    },
    create: {
      id: ADVISOR_ID,
      email: ADVISOR_EMAIL,
      name: "Seed Advisor",
      passwordHash: seedPasswordHash,
    },
  });
  const advisorId = advisor.id;
  console.log("Upserted advisor user.");

  // ── Default pipeline stages ────────────────────────────────────────────
  await prisma.pipelineStage.createMany({
    data: DEFAULT_STAGES.map((s) => ({ ...s, advisorId })),
    skipDuplicates: true,
  });
  console.log(`Upserted ${DEFAULT_STAGES.length} pipeline stages.`);

  // ── Default tags ───────────────────────────────────────────────────────
  await prisma.tag.createMany({
    data: DEFAULT_TAGS.map((name) => ({ name, advisorId })),
    skipDuplicates: true,
  });
  console.log(`Upserted ${DEFAULT_TAGS.length} tags.`);

  console.log("\nSeed complete.");
  console.log(`  Advisor : ${ADVISOR_ID} (${ADVISOR_EMAIL})`);
  console.log(`  Stages  : ${DEFAULT_STAGES.length}`);
  console.log(`  Tags    : ${DEFAULT_TAGS.length}`);
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
