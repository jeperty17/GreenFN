require('dotenv/config')
const { createApp } = require('./app')
const { PORT } = require('./config/env')

const app = createApp()

app.listen(PORT, () => {
  console.log(`GreenFN API listening on http://localhost:${PORT}`)
})
