import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const ADMIN_PASSWORD_HEADER = "x-admin-password";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** The admin password is required only when ADMIN_PASSWORD is set (e.g. in production). */
export function adminPasswordRequired() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function isAdminPassword(given: unknown) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return true;
  if (typeof given !== "string" || !given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Rejects the request unless it carries the admin password header. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (isAdminPassword(req.get(ADMIN_PASSWORD_HEADER))) {
    next();
    return;
  }
  await sleep(600); // slow down password guessing
  res.status(401).json({ error: "The admin password is missing or incorrect." });
}

/** Lets the admin page check a password before showing the settings form. */
export async function verifyAdminPassword(req: Request, res: Response) {
  const password = (req.body as { password?: unknown } | undefined)?.password;
  if (isAdminPassword(password)) {
    res.json({ passwordRequired: adminPasswordRequired() });
    return;
  }
  await sleep(600);
  res.status(401).json({ error: "That password isn't right." });
}
