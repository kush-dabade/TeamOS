import "dotenv/config";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    console.log("Database connected");

    app.listen(PORT, () => {
      console.log(`TeamOS API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start().catch((error) => {
  console.error("Unhandled error during startup:", error);
  process.exit(1);
});
