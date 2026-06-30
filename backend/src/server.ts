import "dotenv/config";
import { createServer } from "node:http";

import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { initializeRealtime } from "./realtime/index.js";

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    console.log("Database connected");

    const server = createServer(app);

    initializeRealtime(server);

    server.on("error", (error) => {
      console.error("Server error:", error);
      process.exit(1);
    });

    server.listen(PORT, () => {
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
