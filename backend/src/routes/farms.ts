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

    const { name, electricityRate, laborRate, prepTimeMinutes, targetProfitMargin } = req.body;

    const updated = await prisma.farm.update({
      where: { id: farm.id },
      data: {
        ...(name !== undefined && { name }),
        ...(electricityRate !== undefined && { electricityRate }),
        ...(laborRate !== undefined && { laborRate }),
        ...(prepTimeMinutes !== undefined && { prepTimeMinutes }),
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

// POST /tax-rates - Add a tax rate
router.post("/tax-rates", async (req: Request, res: Response) => {
  try {
    const farm = await prisma.farm.findFirst({ where: { userId: req.user!.id } });
    if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

    const { name, rate } = req.body;
    if (!name || rate === undefined) {
      res.status(400).json({ error: "Name and rate are required" });
      return;
    }

    const taxRate = await prisma.taxRate.create({
      data: { farmId: farm.id, name, rate },
    });
    res.status(201).json(taxRate);
  } catch (err) {
    console.error("Create tax rate error:", err);
    res.status(500).json({ error: "Failed to create tax rate" });
  }
});

// DELETE /tax-rates/:id - Delete a tax rate
router.delete("/tax-rates/:id", async (req: Request, res: Response) => {
  try {
    const farm = await prisma.farm.findFirst({ where: { userId: req.user!.id } });
    if (!farm) { res.status(404).json({ error: "Farm not found" }); return; }

    const existing = await prisma.taxRate.findFirst({
      where: { id: req.params.id, farmId: farm.id },
    });
    if (!existing) { res.status(404).json({ error: "Tax rate not found" }); return; }

    await prisma.taxRate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete tax rate error:", err);
    res.status(500).json({ error: "Failed to delete tax rate" });
  }
});

export default router;
