import { Router, Request, Response } from "express";
import prisma from "../services/prisma.js";
import { isAuthenticated } from "../middleware/auth.js";
import { recalcModelsForFilament } from "../services/recalc.js";

const router = Router();
router.use(isAuthenticated);

async function getFarmId(userId: string): Promise<string | null> {
  const farm = await prisma.farm.findFirst({
    where: { userId },
    select: { id: true },
  });
  return farm?.id ?? null;
}

// GET / - List all filaments for user's farm
router.get("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const filaments = await prisma.filament.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
    });
    res.json(filaments);
  } catch (err) {
    console.error("List filaments error:", err);
    res.status(500).json({ error: "Failed to fetch filaments" });
  }
});

// POST / - Create a filament
router.post("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const { brand, material, variant, costPerSpool, spoolWeight, colors } = req.body;
    if (!brand || !material || !variant) {
      res.status(400).json({ error: "Brand, material, and variant are required" });
      return;
    }

    const filament = await prisma.filament.create({
      data: {
        farmId,
        brand,
        material,
        variant,
        costPerSpool: costPerSpool ?? 19.99,
        spoolWeight: spoolWeight ?? 1000,
        colors: colors ?? [],
      },
    });
    res.status(201).json(filament);
  } catch (err) {
    console.error("Create filament error:", err);
    res.status(500).json({ error: "Failed to create filament" });
  }
});

// PUT /:id - Update a filament
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const existing = await prisma.filament.findFirst({
      where: { id: req.params.id as string, farmId },
    });
    if (!existing) { res.status(404).json({ error: "Filament not found" }); return; }

    const { brand, material, variant, costPerSpool, spoolWeight, colors } = req.body;
    const updated = await prisma.filament.update({
      where: { id: req.params.id as string },
      data: {
        ...(brand !== undefined && { brand }),
        ...(material !== undefined && { material }),
        ...(variant !== undefined && { variant }),
        ...(costPerSpool !== undefined && { costPerSpool }),
        ...(spoolWeight !== undefined && { spoolWeight }),
        ...(colors !== undefined && { colors }),
      },
    });

    // Recalculate all models using this filament
    if (costPerSpool !== undefined || spoolWeight !== undefined) {
      await recalcModelsForFilament(updated.id);
    }

    res.json(updated);
  } catch (err) {
    console.error("Update filament error:", err);
    res.status(500).json({ error: "Failed to update filament" });
  }
});

// DELETE /:id - Delete a filament
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const existing = await prisma.filament.findFirst({
      where: { id: req.params.id as string, farmId },
    });
    if (!existing) { res.status(404).json({ error: "Filament not found" }); return; }

    await prisma.filament.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete filament error:", err);
    res.status(500).json({ error: "Failed to delete filament" });
  }
});

export default router;
