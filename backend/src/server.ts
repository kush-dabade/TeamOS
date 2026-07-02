import "dotenv/config";
import { createServer } from "node:http";

import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { closeRealtime, initializeRealtime } from "./realtime/index.js";

const PORT = process.env.PORT || 3000;

let isShuttingDown = false;

async function shutdown(
  server: ReturnType<typeof createServer>,
): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log("Shutting down TeamOS API...");

  server.close(async (error) => {
    if (error) {
      console.error("Error closing HTTP server:", error);
      process.exit(1);
    }

    try {
      await closeRealtime();
      await prisma.$disconnect();

      console.log("Shutdown completed successfully.");

      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  });
}

function registerShutdownHandlers(
  server: ReturnType<typeof createServer>,
): void {
  process.on("SIGTERM", () => {
    void shutdown(server);
  });

  process.on("SIGINT", () => {
    void shutdown(server);
  });
}

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    console.log("Database connected");

    const server = createServer(app);

    initializeRealtime(server);

    registerShutdownHandlers(server);

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
