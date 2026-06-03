import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "./prisma.js";

// Parse trusted origins from environment variable or use defaults
const getTrustedOrigins = (): string[] => {
  const envOrigins = process.env.TRUSTED_ORIGINS;
  if (envOrigins) {
    return envOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }
  return ["http://localhost:3000", "http://localhost:5173"];
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  trustedOrigins: getTrustedOrigins(),

  emailAndPassword: {
    enabled: true,
  },
});
