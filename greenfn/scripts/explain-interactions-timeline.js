require("dotenv").config();

const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();

  const advisorResult = await client.query(
    'SELECT id FROM "User" ORDER BY "createdAt" ASC LIMIT 1',
  );

  if (advisorResult.rows.length === 0) {
    throw new Error("No advisor user found.");
  }

  const advisorId = advisorResult.rows[0].id;

  const contactResult = await client.query(
    'SELECT id FROM "Contact" WHERE "advisorId" = $1 ORDER BY "createdAt" ASC LIMIT 1',
    [advisorId],
  );

  if (contactResult.rows.length === 0) {
    throw new Error("No contact found for advisor.");
  }

  const contactId = contactResult.rows[0].id;

  const query = `EXPLAIN (ANALYZE, BUFFERS)
SELECT i."id", i."contactId", i."occurredAt", i."createdAt"
FROM "Interaction" i
JOIN "Contact" c ON c."id" = i."contactId"
WHERE i."contactId" = $1
  AND (i."advisorId" = $2 OR c."advisorId" = $2)
ORDER BY i."occurredAt" DESC, i."createdAt" DESC
LIMIT 100;`;

  const result = await client.query(query, [contactId, advisorId]);

  console.log(result.rows.map((row) => row["QUERY PLAN"]).join("\n"));

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
