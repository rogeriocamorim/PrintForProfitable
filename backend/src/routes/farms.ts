import { Router, Request, Response } from "express";
import prisma from "../services/prisma";
import { isAuthenticated } from "../middleware/auth";

const router = Router();
router.use(isAuthenticated);

// GET / - Get user's farm with all related data
router.get("/", async (req: Request, res: Response) => {
  try {
    const farm = await prisma.farm.findFirst({
      where: { userId: req.user!.id },
      include: {
        taxRates: true,
        printers: true,
        filaments: true,
        salesPlatforms: true,
        shippingProfiles: true,
        models: { include: { filament: true } },
      },
    });

    if (!farm) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    res.json(farm);
  } catch (err) {
    console.error("Get farm error:", err);
    res.status(500).json({ error: "Failed to fetch farm" });
  }
});

// PUT / - Update farm settings
router.put("/", async (req: Request, res: Response) => {
  try {
    const farm = await prisma.farm.findFirst({
      where: { userId: req.user!.id },
    });

    if (!farm) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    const { name, electricityRate, laborRate, targetProfitMargin } = req.body;

    const updated = await prisma.farm.update({
      where: { id: farm.id },
      data: {
        ...(name !== undefined && { name }),
        ...(electricityRate !== undefined && { electricityRate }),
        ...(laborRate !== undefined && { laborRate }),
        ...(targetProfitMargin !== undefined && { targetProfitMargin }),
      },
      include: {
        taxRates: true,
        printers: true,
        filaments: true,
        salesPlatforms: true,
        shippingProfiles: true,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Update farm error:", err);
    res.status(500).json({ error: "Failed to update farm" });
  }
});

export default router;
