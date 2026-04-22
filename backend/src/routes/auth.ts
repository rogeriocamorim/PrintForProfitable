import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "../services/passport.js";
import prisma from "../services/prisma.js";
import { isAuthenticated } from "../middleware/auth.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

// POST /register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "Email, password, and name are required" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        farms: {
          create: { name: `${name}'s Farm` },
        },
      },
      include: { farms: true },
    });

    const token = signToken(user.id);
    const { password: _, ...safeUser } = user;
    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /login
router.post("/login", (req: Request, res: Response) => {
  passport.authenticate(
    "local",
    { session: false },
    (err: Error | null, user: Express.User | false, info: { message: string }) => {
      if (err) {
        return res.status(500).json({ error: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      const token = signToken(user.id);
      const { password: _, ...safeUser } = user;
      return res.json({ token, user: safeUser });
    }
  )(req, res);
});

// Google OAuth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", {
      failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=google`,
    }),
    (req: Request, res: Response) => {
      const token = signToken(req.user!.id);
      res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/auth/callback?token=${token}`
      );
    }
  );
} else {
  router.get("/google", (_req: Request, res: Response) => {
    res.status(501).json({ error: "Google OAuth is not configured" });
  });
}

// GitHub OAuth
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  router.get(
    "/github",
    passport.authenticate("github", { scope: ["user:email"] })
  );

  router.get(
    "/github/callback",
    passport.authenticate("github", {
      failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=github`,
    }),
    (req: Request, res: Response) => {
      const token = signToken(req.user!.id);
      res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/auth/callback?token=${token}`
      );
    }
  );
} else {
  router.get("/github", (_req: Request, res: Response) => {
    res.status(501).json({ error: "GitHub OAuth is not configured" });
  });
}

// GET /providers - which OAuth providers are available
router.get("/providers", (_req: Request, res: Response) => {
  res.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  });
});

// GET /me
router.get("/me", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { farms: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { password: _, ...safeUser } = user;
    res.json({ user: { ...safeUser, impersonatedBy: (req as any).impersonatedBy || null } });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// POST /logout
router.post("/logout", (req: Request, res: Response) => {
  req.logout?.((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
  });
  res.json({ message: "Logged out" });
});

export default router;
