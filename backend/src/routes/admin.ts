import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../services/prisma";
import { isAuthenticated, requireSuperAdmin } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

// Stop impersonation — must come before requireSuperAdmin since
// the impersonation token authenticates as the target user (not admin)
router.post("/stop-impersonation", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const impersonatedBy = (req as any).impersonatedBy;
    if (!impersonatedBy) {
      res.status(400).json({ error: "Not currently impersonating" });
      return;
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: impersonatedBy },
      include: { farms: true },
    });
    if (!adminUser || adminUser.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Original admin not found" });
      return;
    }

    const token = jwt.sign({ userId: adminUser.id }, JWT_SECRET, {
      expiresIn: "7d",
    });
    const { password: _, ...safeUser } = adminUser;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error("Stop impersonation error:", err);
    res.status(500).json({ error: "Failed to stop impersonation" });
  }
});

// All remaining admin routes require authentication + super admin role
router.use(isAuthenticated, requireSuperAdmin);

// ──────────────────────────────────────────────
// SYSTEM STATS
// ──────────────────────────────────────────────

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [totalUsers, totalFarms, totalModels, totalPrinters, totalFilaments] =
      await Promise.all([
        prisma.user.count(),
        prisma.farm.count(),
        prisma.model3D.count(),
        prisma.printer.count(),
        prisma.filament.count(),
      ]);

    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.json({
      totalUsers,
      totalFarms,
      totalModels,
      totalPrinters,
      totalFilaments,
      recentUsers,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ──────────────────────────────────────────────
// USER MANAGEMENT
// ──────────────────────────────────────────────

// List all users
router.get("/users", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || "";

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          provider: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { farms: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin list users error:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// Get single user details
router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        farms: {
          include: {
            _count: {
              select: { printers: true, filaments: true, models: true, salesPlatforms: true },
            },
          },
        },
      },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error("Admin get user error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Update user (role, active status)
router.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const { role, active, name } = req.body;
    const data: Record<string, unknown> = {};
    if (role !== undefined) data.role = role;
    if (active !== undefined) data.active = active;
    if (name !== undefined) data.name = name;

    // Prevent demoting yourself
    if (req.params.id === req.user!.id && role && role !== "SUPER_ADMIN") {
      res.status(400).json({ error: "Cannot remove your own Super Admin role" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(user);
  } catch (err) {
    console.error("Admin update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ──────────────────────────────────────────────
// FARM MANAGEMENT
// ──────────────────────────────────────────────

// List all farms
router.get("/farms", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const [farms, total] = await Promise.all([
      prisma.farm.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: {
            select: { printers: true, filaments: true, models: true, salesPlatforms: true },
          },
        },
      }),
      prisma.farm.count(),
    ]);

    res.json({ farms, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin list farms error:", err);
    res.status(500).json({ error: "Failed to list farms" });
  }
});

// Get single farm details
router.get("/farms/:id", async (req: Request, res: Response) => {
  try {
    const farm = await prisma.farm.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        printers: true,
        filaments: true,
        salesPlatforms: true,
        shippingProfiles: true,
        taxRates: true,
        _count: { select: { models: true } },
      },
    });
    if (!farm) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }
    res.json(farm);
  } catch (err) {
    console.error("Admin get farm error:", err);
    res.status(500).json({ error: "Failed to fetch farm" });
  }
});

// ──────────────────────────────────────────────
// IMPERSONATION
// ──────────────────────────────────────────────

router.post("/impersonate/:userId", async (req: Request, res: Response) => {
  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.userId },
    });
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (targetUser.role === "SUPER_ADMIN") {
      res.status(400).json({ error: "Cannot impersonate another Super Admin" });
      return;
    }

    // Issue a token for the target user, with impersonation metadata
    const token = jwt.sign(
      { userId: targetUser.id, impersonatedBy: req.user!.id },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const { password: _, ...safeUser } = targetUser;
    res.json({ token, user: safeUser, impersonatedBy: req.user!.id });
  } catch (err) {
    console.error("Admin impersonate error:", err);
    res.status(500).json({ error: "Impersonation failed" });
  }
});

// (stop-impersonation is defined above the requireSuperAdmin middleware)

// ──────────────────────────────────────────────
// PLATFORM SETTINGS
// ──────────────────────────────────────────────

// Get all settings
router.get("/settings", async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.platformSettings.findMany();
    const result: Record<string, unknown> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    res.json(result);
  } catch (err) {
    console.error("Admin get settings error:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Upsert a setting
router.put("/settings/:key", async (req: Request, res: Response) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      res.status(400).json({ error: "Value is required" });
      return;
    }

    const setting = await prisma.platformSettings.upsert({
      where: { key: req.params.key },
      update: { value },
      create: { key: req.params.key, value },
    });
    res.json(setting);
  } catch (err) {
    console.error("Admin upsert setting error:", err);
    res.status(500).json({ error: "Failed to save setting" });
  }
});

export default router;
