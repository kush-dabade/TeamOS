import "dotenv/config";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";

const PORT = process.env.PORT || 3000;

async function start() {
  await prisma.$queryRaw`SELECT 1`;

  console.log("Database connected");

  app.listen(PORT, () => {
    console.log(`TeamOS API running on port ${PORT}`);
  });
}

start();
