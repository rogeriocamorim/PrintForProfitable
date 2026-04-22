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

// GET / - List all shipping profiles for user's farm
router.get("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const profiles = await prisma.shippingProfile.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
    });
    res.json(profiles);
  } catch (err) {
    console.error("List shipping profiles error:", err);
    res.status(500).json({ error: "Failed to fetch shipping profiles" });
  }
});

// POST / - Create a shipping profile
router.post("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const { name, customerPays, postageCost, deliveryMinDays, deliveryMaxDays } = req.body;
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const profile = await prisma.shippingProfile.create({
      data: {
        farmId,
        name,
        customerPays: customerPays ?? 5.99,
        postageCost: postageCost ?? 5.0,
        deliveryMinDays: deliveryMinDays ?? 3,
        deliveryMaxDays: deliveryMaxDays ?? 5,
      },
    });
    res.status(201).json(profile);
  } catch (err) {
    console.error("Create shipping profile error:", err);
    res.status(500).json({ error: "Failed to create shipping profile" });
  }
});

// PUT /:id - Update a shipping profile
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const existing = await prisma.shippingProfile.findFirst({
      where: { id: req.params.id as string, farmId },
    });
    if (!existing) { res.status(404).json({ error: "Shipping profile not found" }); return; }

    const { name, customerPays, postageCost, deliveryMinDays, deliveryMaxDays } = req.body;
    const updated = await prisma.shippingProfile.update({
      where: { id: req.params.id as string },
      data: {
        ...(name !== undefined && { name }),
        ...(customerPays !== undefined && { customerPays }),
        ...(postageCost !== undefined && { postageCost }),
        ...(deliveryMinDays !== undefined && { deliveryMinDays }),
        ...(deliveryMaxDays !== undefined && { deliveryMaxDays }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("Update shipping profile error:", err);
    res.status(500).json({ error: "Failed to update shipping profile" });
  }
});

// DELETE /:id - Delete a shipping profile
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const existing = await prisma.shippingProfile.findFirst({
      where: { id: req.params.id as string, farmId },
    });
    if (!existing) { res.status(404).json({ error: "Shipping profile not found" }); return; }

    await prisma.shippingProfile.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete shipping profile error:", err);
    res.status(500).json({ error: "Failed to delete shipping profile" });
  }
});

export default router;
