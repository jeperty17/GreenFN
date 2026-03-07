require('dotenv/config')
const { Client } = require('pg')

const advisor = {
  id: 'seed-advisor-001',
  email: 'advisor.seed@greenfn.local',
  name: 'Seed Advisor',
}

const pipelineStageNames = [
  'New',
  'Contacted',
  'Booked',
  'No-show',
  'In Progress',
  'Closed Won',
  'Closed Lost',
]

const contacts = [
  {
    id: 'seed-contact-001',
    fullName: 'Alicia Tan',
    email: 'alicia.tan@example.com',
    phone: '+6591110001',
    source: 'Instagram',
    stageName: 'New',
    type: 'LEAD',
    isStarred: true,
    notes: 'Interested in protection + savings review',
  },
  {
    id: 'seed-contact-002',
    fullName: 'Brandon Lim',
    email: 'brandon.lim@example.com',
    phone: '+6591110002',
    source: 'Referral',
    stageName: 'Booked',
    type: 'LEAD',
    isStarred: false,
    notes: 'Booked first consultation for next week',
  },
  {
    id: 'seed-contact-003',
    fullName: 'Cheryl Ng',
    email: 'cheryl.ng@example.com',
    phone: '+6591110003',
    source: 'Roadshow',
    stageName: 'In Progress',
    type: 'CLIENT',
    isStarred: true,
    notes: 'Existing client reviewing portfolio allocation',
  },
]

async function seed() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('Missing DIRECT_URL or DATABASE_URL for seeding')
  }

  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query('BEGIN')

    await client.query('SELECT set_config($1, $2, false)', ['app.current_advisor_id', advisor.id])

    await client.query(
      `INSERT INTO "User" ("id", "email", "name", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT ("id") DO UPDATE
       SET "email" = EXCLUDED."email",
           "name" = EXCLUDED."name",
           "updatedAt" = NOW()`,
      [advisor.id, advisor.email, advisor.name]
    )

    for (let index = 0; index < pipelineStageNames.length; index += 1) {
      const stageName = pipelineStageNames[index]
      const stageOrder = index + 1
      const stageId = `seed-stage-${String(stageOrder).padStart(2, '0')}`

      await client.query(
        `INSERT INTO "PipelineStage" ("id", "advisorId", "name", "order", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT ("advisorId", "name") DO UPDATE
         SET "order" = EXCLUDED."order",
             "updatedAt" = NOW()`,
        [stageId, advisor.id, stageName, stageOrder]
      )
    }

    const stageResult = await client.query(
      `SELECT "id", "name"
       FROM "PipelineStage"
       WHERE "advisorId" = $1`,
      [advisor.id]
    )

    const stageIdByName = new Map(stageResult.rows.map((row) => [row.name, row.id]))

    for (const contact of contacts) {
      const stageId = stageIdByName.get(contact.stageName)

      if (!stageId) {
        throw new Error(`Missing pipeline stage id for ${contact.stageName}`)
      }

      await client.query(
        `INSERT INTO "Contact" (
          "id", "advisorId", "type", "stageId", "fullName", "phone", "email", "source", "isStarred", "notes", "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3::"ContactType", $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT ("id") DO UPDATE
         SET "advisorId" = EXCLUDED."advisorId",
             "type" = EXCLUDED."type",
             "stageId" = EXCLUDED."stageId",
             "fullName" = EXCLUDED."fullName",
             "phone" = EXCLUDED."phone",
             "email" = EXCLUDED."email",
             "source" = EXCLUDED."source",
             "isStarred" = EXCLUDED."isStarred",
             "notes" = EXCLUDED."notes",
             "updatedAt" = NOW()`,
        [
          contact.id,
          advisor.id,
          contact.type,
          stageId,
          contact.fullName,
          contact.phone,
          contact.email,
          contact.source,
          contact.isStarred,
          contact.notes,
        ]
      )
    }

    await client.query(
      `INSERT INTO "Tag" ("id", "advisorId", "name")
       VALUES ($1, $2, $3)
       ON CONFLICT ("advisorId", "name") DO NOTHING`,
      ['seed-tag-high-priority', advisor.id, 'High Priority']
    )

    await client.query(
      `INSERT INTO "Tag" ("id", "advisorId", "name")
       VALUES ($1, $2, $3)
       ON CONFLICT ("advisorId", "name") DO NOTHING`,
      ['seed-tag-family', advisor.id, 'Family Planning']
    )

    await client.query(
      `INSERT INTO "ContactTag" ("contactId", "tagId")
       VALUES ($1, $2)
       ON CONFLICT ("contactId", "tagId") DO NOTHING`,
      ['seed-contact-001', 'seed-tag-high-priority']
    )

    await client.query(
      `INSERT INTO "ContactTag" ("contactId", "tagId")
       VALUES ($1, $2)
       ON CONFLICT ("contactId", "tagId") DO NOTHING`,
      ['seed-contact-003', 'seed-tag-family']
    )

    await client.query(
      `INSERT INTO "Interaction" ("id", "contactId", "type", "occurredAt", "notes", "createdAt")
       VALUES ($1, $2, $3::"InteractionType", NOW() - INTERVAL '2 days', $4, NOW())
       ON CONFLICT ("id") DO UPDATE
       SET "notes" = EXCLUDED."notes"`,
      ['seed-interaction-001', 'seed-contact-001', 'WHATSAPP', 'Discussed child education planning goals.']
    )

    await client.query(
      `INSERT INTO "NextStep" (
         "id", "contactId", "title", "description", "dueAt", "status", "createdAt", "updatedAt"
       )
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day', $5::"TaskStatus", NOW(), NOW())
       ON CONFLICT ("id") DO UPDATE
       SET "title" = EXCLUDED."title",
           "description" = EXCLUDED."description",
           "dueAt" = EXCLUDED."dueAt",
           "status" = EXCLUDED."status",
           "updatedAt" = NOW()`,
      [
        'seed-next-step-001',
        'seed-contact-001',
        'Send follow-up proposal',
        'Prepare recommendation summary and send by WhatsApp.',
        'OPEN',
      ]
    )

    await client.query('COMMIT')

    const summary = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM "PipelineStage" WHERE "advisorId" = $1) AS stages,
         (SELECT COUNT(*) FROM "Contact" WHERE "advisorId" = $1) AS contacts,
         (SELECT COUNT(*) FROM "Tag" WHERE "advisorId" = $1) AS tags`,
      [advisor.id]
    )

    const result = summary.rows[0]
    console.log('Seed completed successfully')
    console.log(`Advisor: ${advisor.id}`)
    console.log(`Pipeline stages: ${result.stages}`)
    console.log(`Contacts: ${result.contacts}`)
    console.log(`Tags: ${result.tags}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
