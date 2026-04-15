require("dotenv").config();

const prisma = require("../src/lib/prisma");

async function ensureData(contactId, advisorId, targetCount) {
  const existing = await prisma.interaction.count({ where: { contactId } });
  const missing = Math.max(0, targetCount - existing);

  if (missing === 0) {
    return { existing, inserted: 0 };
  }

  const types = ["CALL", "MEETING", "WHATSAPP_DM", "GENERAL_NOTE"];
  const now = Date.now();

  const data = Array.from({ length: missing }, (_, i) => {
    const offsetMinutes = i + 1;

    return {
      contactId,
      advisorId,
      type: types[i % types.length],
      occurredAt: new Date(now - offsetMinutes * 60000),
      notes: `perf-seed-${offsetMinutes}`,
    };
  });

  await prisma.interaction.createMany({ data });

  return { existing, inserted: missing };
}

async function benchmark(contactId, advisorId, pageSize, iterations) {
  const durations = [];

  for (let i = 0; i < iterations; i += 1) {
    const start = process.hrtime.bigint();

    await prisma.interaction.findMany({
      where: {
        contactId,
        OR: [{ advisorId }, { contact: { advisorId } }],
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: pageSize,
      include: {
        contact: {
          select: { id: true, fullName: true },
        },
        aiSummaryRecord: {
          select: {
            id: true,
            summaryText: true,
            model: true,
            sourceMode: true,
            generatedAt: true,
          },
        },
      },
    });

    const end = process.hrtime.bigint();
    durations.push(Number(end - start) / 1e6);
  }

  durations.sort((a, b) => a - b);

  const avg = durations.reduce((sum, v) => sum + v, 0) / durations.length;
  const p95 = durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)];

  return {
    pageSize,
    iterations,
    avgMs: Number(avg.toFixed(2)),
    p95Ms: Number(p95.toFixed(2)),
    minMs: Number(durations[0].toFixed(2)),
    maxMs: Number(durations[durations.length - 1].toFixed(2)),
  };
}

async function main() {
  const advisor = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!advisor) {
    throw new Error("No advisor user found.");
  }

  const contact = await prisma.contact.findFirst({
    where: { advisorId: advisor.id },
    orderBy: { createdAt: "asc" },
  });

  if (!contact) {
    throw new Error("No contact found for advisor.");
  }

  const targetCount = 5000;
  const seedInfo = await ensureData(contact.id, advisor.id, targetCount);
  const totalForContact = await prisma.interaction.count({
    where: { contactId: contact.id },
  });

  const results = [];
  results.push(await benchmark(contact.id, advisor.id, 20, 25));
  results.push(await benchmark(contact.id, advisor.id, 50, 25));
  results.push(await benchmark(contact.id, advisor.id, 100, 25));

  console.log(
    JSON.stringify(
      {
        advisorId: advisor.id,
        contactId: contact.id,
        seeded: seedInfo,
        totalInteractionsForContact: totalForContact,
        benchmarks: results,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
