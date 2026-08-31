import type { Request, Response } from "express";

import { provisionDemoSession } from "./demo.service.js";

export async function createDemoSessionHandler(_req: Request, res: Response) {
  const { headers, expiresAt } = await provisionDemoSession();

  // Copies Better Auth's own real Set-Cookie header(s) onto this response -
  // Headers.getSetCookie() (WHATWG fetch, available in this Node runtime)
  // is required here rather than headers.get("set-cookie"): a plain .get()
  // silently joins multiple Set-Cookie values with ", ", which is not a
  // valid way to send more than one cookie. res.append (not res.setHeader)
  // preserves each as its own header line the same way.
  for (const cookie of headers.getSetCookie()) {
    res.append("Set-Cookie", cookie);
  }

  // Deliberately minimal: no user id, email, password, or session token in
  // the JSON body - the browser only needs the cookie (already applied
  // above) to be authenticated for every subsequent request.
  return res.status(201).json({
    success: true,
    data: {
      expiresAt,
    },
  });
}
