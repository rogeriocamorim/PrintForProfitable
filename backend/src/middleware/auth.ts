import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../services/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check passport session first
  if (req.isAuthenticated?.() && req.user) {
    return next();
  }

  // Check JWT from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      impersonatedBy?: string;
    };

    prisma.user
      .findUnique({ where: { id: payload.userId } })
      .then((user) => {
        if (!user) {
          res.status(401).json({ error: "User not found" });
          return;
        }
        if (!user.active) {
          res.status(403).json({ error: "Account deactivated" });
          return;
        }
        req.user = user;
        // Track impersonation context
        if (payload.impersonatedBy) {
          (req as any).impersonatedBy = payload.impersonatedBy;
        }
        next();
      })
      .catch(() => {
        res.status(401).json({ error: "Authentication failed" });
      });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.user.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Super Admin access required" });
    return;
  }
  next();
}
