function logContactsRequestMetrics(req, res, durationMs) {
  const outcome = res.statusCode >= 500 ? 'server_error' : res.statusCode >= 400 ? 'client_error' : 'ok'
  console.log(
    `[contacts-metrics] method=${req.method} path=${req.originalUrl} status=${res.statusCode} outcome=${outcome} durationMs=${durationMs.toFixed(1)}`
  )
}

module.exports = { logContactsRequestMetrics }
