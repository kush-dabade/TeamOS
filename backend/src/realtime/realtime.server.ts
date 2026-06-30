import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { prisma } from "../lib/prisma.js";

import { authenticateSocket } from "./realtime.auth.js";
import { getWorkspaceRoom } from "./realtime.rooms.js";
import type { AuthenticatedSocket } from "./realtime.types.js";

let io: Server | null = null;

export function initializeRealtime(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: process.env.TRUSTED_ORIGINS?.split(",").map((origin) =>
        origin.trim(),
      ) ?? ["http://localhost:3000", "http://localhost:5173"],
      credentials: true,
    },
  });

  registerMiddleware(io);
  registerConnectionHandlers(io);

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error(
      "Socket.IO has not been initialized. Call initializeRealtime() first.",
    );
  }

  return io;
}

function registerMiddleware(io: Server): void {
  io.use(authenticateSocket);
}

async function joinWorkspaceRooms(socket: AuthenticatedSocket): Promise<void> {
  const memberships = await prisma.workspaceMember.findMany({
    where: {
      userId: socket.data.user.id,
    },
    select: {
      workspaceId: true,
    },
  });

  for (const membership of memberships) {
    socket.join(getWorkspaceRoom(membership.workspaceId));
  }

  console.log(
    `Socket ${socket.id} joined ${memberships.length} workspace room(s)`,
  );
}

function registerConnectionHandlers(io: Server): void {
  io.on("connection", async (socket) => {
    try {
      const authenticatedSocket = socket as AuthenticatedSocket;

      await joinWorkspaceRooms(authenticatedSocket);

      console.log(`Socket connected: ${socket.id}`);

      socket.on("disconnect", (reason) => {
        console.log(`Socket disconnected: ${socket.id} (${reason})`);
      });
    } catch (error) {
      console.error("Socket connection setup failed:", error);

      socket.disconnect(true);
    }
  });
}