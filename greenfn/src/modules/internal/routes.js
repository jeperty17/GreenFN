const express = require('express')
const prisma = require('../../lib/prisma')
const { API_BASE_PATH, NODE_ENV } = require('../../config/env')
const { getRecentOperations, getRecentOperationsByFeature } = require('../../lib/operationTracker')

const router = express.Router()

const FEATURE_CARDS = [
  { key: 'contacts', label: 'Contacts Hub', path: '/contacts?page=1&pageSize=10' },
  { key: 'pipeline', label: 'Leads Pipeline', path: '/pipeline' },
  { key: 'tasks', label: 'Today Tasks', path: '/tasks' },
  { key: 'interactions', label: 'Interaction History', path: '/interactions' },
  { key: 'ai', label: 'AI Summaries', path: '/ai' },
]

function isLocalAddress(value) {
  const normalizedValue = String(value || '').toLowerCase()

  return (
    normalizedValue === 'localhost' ||
    normalizedValue === '127.0.0.1' ||
    normalizedValue === '::1' ||
    normalizedValue.startsWith('::ffff:127.0.0.1')
  )
}

function ensureLocalValidationAccess(req, res, next) {
  if (NODE_ENV === 'production') {
    res.status(404).json({ message: 'Not found' })
    return
  }

  const host = String(req.hostname || '').split(':')[0]
  const ip = String(req.ip || req.socket?.remoteAddress || '')

  if (!isLocalAddress(host) && !isLocalAddress(ip)) {
    res.status(404).json({ message: 'Not found' })
    return
  }

  next()
}

function formatDuration(durationMs) {
  const value = Number(durationMs || 0)
  return `${value.toFixed(1)} ms`
}

async function resolveFirstContactId() {
  const firstContact = await prisma.contact.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  return firstContact?.id || null
}

function buildFeatureCards(firstContactId) {
  return FEATURE_CARDS.map((feature) => {
    if (feature.key !== 'interactions') {
      return {
        ...feature,
        href: `${API_BASE_PATH}${feature.path}`,
      }
    }

    if (!firstContactId) {
      return {
        ...feature,
        href: `${API_BASE_PATH}/interactions`,
      }
    }

    return {
      ...feature,
      href: `${API_BASE_PATH}/interactions?contactId=${encodeURIComponent(firstContactId)}&page=1&pageSize=10`,
    }
  })
}

function renderFeatureOperationRows(featureKey) {
  const rows = getRecentOperationsByFeature(featureKey, 5)

  if (rows.length === 0) {
    return '<tr><td colspan="5">No recent operations captured yet.</td></tr>'
  }

  return rows
    .map(
      (row) =>
        `<tr><td>${row.crud}</td><td>${row.method}</td><td>${row.statusCode}</td><td>${formatDuration(
          row.durationMs
        )}</td><td>${row.path}</td></tr>`
    )
    .join('')
}

function renderGlobalRows() {
  const rows = getRecentOperations(12)

  if (rows.length === 0) {
    return '<tr><td colspan="6">No recent operations captured yet.</td></tr>'
  }

  return rows
    .map(
      (row) =>
        `<tr><td>${row.feature}</td><td>${row.crud}</td><td>${row.statusCode}</td><td>${formatDuration(
          row.durationMs
        )}</td><td>${row.path}</td><td>${row.at}</td></tr>`
    )
    .join('')
}

function renderPage(cards) {
  const featureTables = cards
    .map(
      (card) => `
      <section class="feature-log">
        <h3>${card.label} - Recent API operations</h3>
        <table>
          <thead>
            <tr><th>CRUD</th><th>Method</th><th>Status</th><th>Latency</th><th>Path</th></tr>
          </thead>
          <tbody>
            ${renderFeatureOperationRows(card.key)}
          </tbody>
        </table>
      </section>
    `
    )
    .join('')

  const cardsMarkup = cards
    .map(
      (card) => `
      <a class="feature-card" href="${card.href}">
        <h2>${card.label}</h2>
        <p>Open ${card.label} backend flow</p>
        <span>Go</span>
      </a>
    `
    )
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GreenFN Internal Validation Console</title>
  <style>
    :root {
      --bg: #f3f6f8;
      --ink: #102027;
      --brand: #0f766e;
      --brand-soft: #d8f4ef;
      --card: #ffffff;
      --line: #d5e2e8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      background: radial-gradient(circle at top right, #e9f7f4, var(--bg) 55%);
      color: var(--ink);
      padding: 24px;
    }
    main { max-width: 1100px; margin: 0 auto; }
    .header {
      background: var(--card);
      border: 1px solid var(--line);
      border-left: 6px solid var(--brand);
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 18px;
    }
    .header h1 { margin: 0 0 6px; font-size: 1.4rem; }
    .header p { margin: 0; color: #35515c; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }
    .feature-card {
      text-decoration: none;
      color: inherit;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 122px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .feature-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(16, 32, 39, 0.08);
    }
    .feature-card h2 { font-size: 1.05rem; margin: 0; }
    .feature-card p { margin: 0; color: #4f6b76; font-size: 0.9rem; }
    .feature-card span {
      margin-top: auto;
      font-size: 0.85rem;
      color: var(--brand);
      font-weight: 700;
    }
    .panel {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 14px;
      overflow: auto;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid var(--line);
      font-size: 0.86rem;
      vertical-align: top;
    }
    th { background: var(--brand-soft); }
    .feature-log {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 12px;
      overflow: auto;
    }
    .feature-log h3 { margin: 0 0 8px; font-size: 0.96rem; }
    .note {
      margin-top: 10px;
      color: #4f6b76;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <main>
    <section class="header">
      <h1>GreenFN Internal Validation Console</h1>
      <p>Local-only backend validation panel. Use the five feature buttons to trigger real API flows and inspect recent CRUD traces captured by this process.</p>
      <p class="note">Access path: <strong>/internal/validation</strong>. This view is disabled in production mode and hidden for non-local requests.</p>
    </section>

    <section class="cards">
      ${cardsMarkup}
    </section>

    <section class="panel">
      <h3>Global recent API operations</h3>
      <table>
        <thead>
          <tr><th>Feature</th><th>CRUD</th><th>Status</th><th>Latency</th><th>Path</th><th>Timestamp</th></tr>
        </thead>
        <tbody>
          ${renderGlobalRows()}
        </tbody>
      </table>
    </section>

    ${featureTables}
  </main>
</body>
</html>`
}

router.use(ensureLocalValidationAccess)

router.get('/validation', async (_req, res, next) => {
  try {
    const firstContactId = await resolveFirstContactId()
    const cards = buildFeatureCards(firstContactId)
    res.status(200).type('html').send(renderPage(cards))
  } catch (error) {
    next(error)
  }
})

router.get('/validation/operations', (_req, res) => {
  res.json({ items: getRecentOperations(40) })
})

module.exports = router
