import { Router, Request, Response } from "express";
import prisma from "../services/prisma";
import { isAuthenticated } from "../middleware/auth";

const router = Router();
router.use(isAuthenticated);

// Helper: get user's farm ID
async function getFarmId(userId: string): Promise<string | null> {
  const farm = await prisma.farm.findFirst({
    where: { userId },
    select: { id: true },
  });
  return farm?.id ?? null;
}

// GET / - List all printers for user's farm
router.get("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const printers = await prisma.printer.findMany({
      where: { farmId },
      orderBy: { createdAt: "desc" },
    });
    res.json(printers);
  } catch (err) {
    console.error("List printers error:", err);
    res.status(500).json({ error: "Failed to fetch printers" });
  }
});

// POST / - Create a printer
router.post("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const { brand, model, powerConsumption, imageUrl, purchasePrice, expectedLifetimeHours } = req.body;
    if (!brand || !model) {
      res.status(400).json({ error: "Brand and model are required" });
      return;
    }

    const printer = await prisma.printer.create({
      data: {
        farmId,
        brand,
        model,
        powerConsumption: powerConsumption ?? 200,
        imageUrl,
        purchasePrice: purchasePrice ?? 0,
        expectedLifetimeHours: expectedLifetimeHours ?? 5000,
      },
    });
    res.status(201).json(printer);
  } catch (err) {
    console.error("Create printer error:", err);
    res.status(500).json({ error: "Failed to create printer" });
  }
});

// PUT /:id - Update a printer
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const existing = await prisma.printer.findFirst({
      where: { id: req.params.id, farmId },
    });
    if (!existing) { res.status(404).json({ error: "Printer not found" }); return; }

    const { brand, model, powerConsumption, imageUrl, purchasePrice, expectedLifetimeHours } = req.body;
    const updated = await prisma.printer.update({
      where: { id: req.params.id },
      data: {
        ...(brand !== undefined && { brand }),
        ...(model !== undefined && { model }),
        ...(powerConsumption !== undefined && { powerConsumption }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(purchasePrice !== undefined && { purchasePrice }),
        ...(expectedLifetimeHours !== undefined && { expectedLifetimeHours }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("Update printer error:", err);
    res.status(500).json({ error: "Failed to update printer" });
  }
});

// DELETE /:id - Delete a printer
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const existing = await prisma.printer.findFirst({
      where: { id: req.params.id, farmId },
    });
    if (!existing) { res.status(404).json({ error: "Printer not found" }); return; }

    await prisma.printer.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete printer error:", err);
    res.status(500).json({ error: "Failed to delete printer" });
  }
});

export default router;
