'use strict'

require('dotenv').config()

const { PrismaClient } = require('../../generated/prisma')

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
})

module.exports = prisma
