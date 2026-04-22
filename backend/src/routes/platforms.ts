import { Router, Request, Response } from "express";
import prisma from "../services/prisma.js";
import { isAuthenticated } from "../middleware/auth.js";

const router = Router();
router.use(isAuthenticated);

async function getFarmId(userId: string): Promise<string | null> {
  const farm = await prisma.farm.findFirst({
    where: { userId },
    select: { id: true },
  });
  return farm?.id ?? null;
}

// GET / - List all sales platforms for user's farm
router.get("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const platforms = await prisma.salesPlatform.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
    });
    res.json(platforms);
  } catch (err) {
    console.error("List platforms error:", err);
    res.status(500).json({ error: "Failed to fetch platforms" });
  }
});

// POST / - Create a sales platform
router.post("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const { type, shopName, feesConfig, enabled } = req.body;
    if (!type || !shopName) {
      res.status(400).json({ error: "Type and shop name are required" });
      return;
    }

    const platform = await prisma.salesPlatform.create({
      data: {
        farmId,
        type,
        shopName,
        feesConfig: feesConfig ?? {},
        enabled: enabled ?? true,
      },
    });
    res.status(201).json(platform);
  } catch (err) {
    console.error("Create platform error:", err);
    res.status(500).json({ error: "Failed to create platform" });
  }
});

// PUT /:id - Update a sales platform
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const existing = await prisma.salesPlatform.findFirst({
      where: { id: req.params.id as string, farmId },
    });
    if (!existing) { res.status(404).json({ error: "Platform not found" }); return; }

    const { type, shopName, feesConfig, enabled } = req.body;
    const updated = await prisma.salesPlatform.update({
      where: { id: req.params.id as string },
      data: {
        ...(type !== undefined && { type }),
        ...(shopName !== undefined && { shopName }),
        ...(feesConfig !== undefined && { feesConfig }),
        ...(enabled !== undefined && { enabled }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("Update platform error:", err);
    res.status(500).json({ error: "Failed to update platform" });
  }
});

// DELETE /:id - Delete a sales platform
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const existing = await prisma.salesPlatform.findFirst({
      where: { id: req.params.id as string, farmId },
    });
    if (!existing) { res.status(404).json({ error: "Platform not found" }); return; }

    await prisma.salesPlatform.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete platform error:", err);
    res.status(500).json({ error: "Failed to delete platform" });
  }
});

export default router;
