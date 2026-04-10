"use strict";

require("dotenv").config();

const { PrismaClient } = require("../../generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL || process.env.DIRECT_URL || "";

if (!connectionString) {
  throw new Error(
    "Missing required environment variable: DATABASE_URL or DIRECT_URL",
  );
}

const isLocalConnection = /localhost|127\.0\.0\.1/i.test(connectionString);

const pool = new Pool({
  connectionString,
  ...(isLocalConnection ? {} : { ssl: { rejectUnauthorized: false } }),
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

module.exports = prisma;
