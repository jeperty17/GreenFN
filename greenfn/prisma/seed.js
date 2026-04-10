"use strict";

require("dotenv").config();

const { PrismaClient } = require("../generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

// Seed bypasses the Prisma proxy and connects directly via pg adapter.
// DIRECT_URL must be reachable (port 5432). If it times out locally,
// temporarily swap it for the pgbouncer URL (port 6543, no ?pgbouncer=true).
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

const STAGES = [
  { id: "seed-stage-001", name: "New", order: 1 },
  { id: "seed-stage-002", name: "Contacted", order: 2 },
  { id: "seed-stage-003", name: "Booked", order: 3 },
  { id: "seed-stage-004", name: "No-show", order: 4 },
  { id: "seed-stage-005", name: "In Progress", order: 5 },
  { id: "seed-stage-006", name: "Closed Won", order: 6 },
  { id: "seed-stage-007", name: "Closed Lost", order: 7 },
];

const CONTACTS = [
  {
    id: "seed-contact-001",
    fullName: "Alice Tan",
    type: "LEAD",
    stageId: "seed-stage-001",
    email: "alice.tan@example.com",
    phone: "+6591000001",
    source: "Referral",
  },
  {
    id: "seed-contact-002",
    fullName: "Bob Lim",
    type: "LEAD",
    stageId: "seed-stage-003",
    email: "bob.lim@example.com",
    phone: "+6591000002",
    source: "Cold Call",
  },
  {
    id: "seed-contact-003",
    fullName: "Carol Wong",
    type: "CLIENT",
    stageId: "seed-stage-006",
    email: "carol.wong@example.com",
    phone: "+6591000003",
    source: "Referral",
  },
];

const TAGS = [
  { id: "seed-tag-001", name: "High Priority" },
  { id: "seed-tag-002", name: "Follow Up" },
];

async function seed() {
  console.log("Starting seed...");

  // ── Advisor user ───────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { id: ADVISOR_ID },
    update: {},
    create: { id: ADVISOR_ID, email: ADVISOR_EMAIL, name: "Seed Advisor" },
  });
  console.log("Upserted advisor user.");

  // ── Pipeline stages ────────────────────────────────────────────────────
  for (const stage of STAGES) {
    await prisma.pipelineStage.upsert({
      where: { id: stage.id },
      update: {},
      create: {
        id: stage.id,
        advisorId: ADVISOR_ID,
        name: stage.name,
        order: stage.order,
      },
    });
  }
  console.log("Upserted 7 pipeline stages.");

  // ── Contacts ───────────────────────────────────────────────────────────
  for (const c of CONTACTS) {
    await prisma.contact.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        advisorId: ADVISOR_ID,
        fullName: c.fullName,
        type: c.type,
        stageId: c.stageId,
        email: c.email,
        phone: c.phone,
        source: c.source,
      },
    });
  }
  console.log("Upserted 3 contacts.");

  // ── Tags ───────────────────────────────────────────────────────────────
  for (const tag of TAGS) {
    await prisma.tag.upsert({
      where: { id: tag.id },
      update: {},
      create: { id: tag.id, advisorId: ADVISOR_ID, name: tag.name },
    });
  }
  console.log("Upserted 2 tags.");

  // ── Contact-tag links ──────────────────────────────────────────────────
  // Alice → both tags; Bob → Follow Up
  const contactTags = [
    { contactId: "seed-contact-001", tagId: "seed-tag-001" },
    { contactId: "seed-contact-001", tagId: "seed-tag-002" },
    { contactId: "seed-contact-002", tagId: "seed-tag-002" },
  ];
  for (const ct of contactTags) {
    await prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId: ct.contactId, tagId: ct.tagId } },
      update: {},
      create: ct,
    });
  }
  console.log("Upserted contact-tag links.");

  // ── Sample interaction ─────────────────────────────────────────────────
  await prisma.interaction.upsert({
    where: { id: "seed-interaction-001" },
    update: {},
    create: {
      id: "seed-interaction-001",
      contactId: "seed-contact-003",
      type: "MEETING",
      notes:
        "Reviewed Carol's current policy coverage. She is interested in upgrading her life plan.",
    },
  });
  console.log("Upserted sample interaction.");

  // ── Sample next-step task ──────────────────────────────────────────────
  await prisma.nextStep.upsert({
    where: { id: "seed-nextstep-001" },
    update: {},
    create: {
      id: "seed-nextstep-001",
      contactId: "seed-contact-002",
      title: "Send follow-up proposal",
      description:
        "Email Bob the term life proposal discussed during the call.",
      status: "OPEN",
    },
  });
  console.log("Upserted sample next-step task.");

  console.log("\nSeed complete.");
  console.log("  Advisor : seed-user-001 (advisor.seed@greenfn.local)");
  console.log("  Stages  : 7");
  console.log("  Contacts: 3  (Alice, Bob, Carol)");
  console.log("  Tags    : 2  (High Priority, Follow Up)");
  console.log("  Interactions: 1");
  console.log("  Next steps  : 1");
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
