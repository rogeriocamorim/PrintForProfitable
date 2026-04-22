import "dotenv/config";
import path from "path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname!, "prisma/schema.prisma"),
  migrate: {
    schema: path.join(import.meta.dirname!, "prisma/schema.prisma"),
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
