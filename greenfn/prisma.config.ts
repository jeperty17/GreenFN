import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // DIRECT_URL (port 5432) is used by Prisma CLI for migrations and introspection.
  // Accessible from Railway/cloud; blocked on some local networks.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
