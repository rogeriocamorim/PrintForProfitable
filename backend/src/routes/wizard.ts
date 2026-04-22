import { Router, Request, Response } from "express";
import prisma from "../services/prisma.js";
import { isAuthenticated } from "../middleware/auth.js";

const router = Router();
router.use(isAuthenticated);

// Default fees per platform type (US region) — applied when wizard doesn't send numeric fees
const PLATFORM_FEE_DEFAULTS: Record<string, Record<string, string>> = {
  ETSY:    { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.20' },
  AMAZON:  { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
  SHOPIFY: { transactionPct: '0', processingPct: '2.9', processingFlat: '0.30', listingFee: '0' },
  TIKTOK:  { transactionPct: '8', processingPct: '2.9', processingFlat: '0.30', listingFee: '0' },
  EBAY:    { transactionPct: '13.25', processingPct: '0', processingFlat: '0.30', listingFee: '0' },
  CUSTOM:  { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
};

// Helper to get the user's farm
async function getUserFarm(userId: string) {
  return prisma.farm.findFirst({ where: { userId } });
}

// PUT /step1 - Farm basics + tax rates
router.put("/step1", async (req: Request, res: Response) => {
  try {
    const farm = await getUserFarm(req.user!.id);
    if (!farm) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    const { name, electricityRate, laborRate, taxRates, targetProfitMargin } = req.body;

    const updatedFarm = await prisma.farm.update({
      where: { id: farm.id },
      data: {
        ...(name !== undefined && { name }),
        ...(electricityRate !== undefined && { electricityRate }),
        ...(laborRate !== undefined && { laborRate }),
        ...(targetProfitMargin !== undefined && { targetProfitMargin }),
      },
    });

    // Replace tax rates if provided
    if (Array.isArray(taxRates)) {
      await prisma.taxRate.deleteMany({ where: { farmId: farm.id } });
      if (taxRates.length > 0) {
        await prisma.taxRate.createMany({
          data: taxRates.map((t: { name: string; rate: number }) => ({
            farmId: farm.id,
            name: t.name,
            rate: t.rate,
          })),
        });
      }
    }

    const result = await prisma.farm.findUnique({
      where: { id: farm.id },
      include: { taxRates: true },
    });

    res.json(result);
  } catch (err) {
    console.error("Wizard step1 error:", err);
    res.status(500).json({ error: "Failed to update farm basics" });
  }
});

// PUT /step2 - Equipment (printers + filaments)
router.put("/step2", async (req: Request, res: Response) => {
  try {
    const farm = await getUserFarm(req.user!.id);
    if (!farm) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    const { printers, filaments } = req.body;

    if (Array.isArray(printers)) {
      await prisma.printer.deleteMany({ where: { farmId: farm.id } });
      if (printers.length > 0) {
        await prisma.printer.createMany({
          data: printers.map(
            (p: {
              brand: string;
              model: string;
              powerConsumption?: number;
              purchasePrice?: number;
              expectedLifetimeHours?: number;
              imageUrl?: string;
              preselected?: boolean;
            }) => ({
              farmId: farm.id,
              brand: p.brand,
              model: p.model,
              powerConsumption: p.powerConsumption ?? 200,
              purchasePrice: p.purchasePrice ?? 0,
              expectedLifetimeHours: p.expectedLifetimeHours ?? 5000,
              imageUrl: p.imageUrl ?? null,
              preselected: p.preselected ?? false,
            })
          ),
        });
      }
    }

    if (Array.isArray(filaments)) {
      await prisma.filament.deleteMany({ where: { farmId: farm.id } });
      if (filaments.length > 0) {
        await prisma.filament.createMany({
          data: filaments.map(
            (f: {
              brand: string;
              material: string;
              variant: string;
              costPerSpool?: number;
              spoolWeight?: number;
              colors?: string[];
            }) => ({
              farmId: farm.id,
              brand: f.brand,
              material: f.material,
              variant: f.variant,
              costPerSpool: f.costPerSpool ?? 19.99,
              spoolWeight: f.spoolWeight ?? 1000,
              colors: f.colors ?? [],
            })
          ),
        });
      }
    }

    const result = await prisma.farm.findUnique({
      where: { id: farm.id },
      include: { printers: true, filaments: true },
    });

    res.json(result);
  } catch (err) {
    console.error("Wizard step2 error:", err);
    res.status(500).json({ error: "Failed to update equipment" });
  }
});

// PUT /step3 - Sales platforms + shipping profiles
router.put("/step3", async (req: Request, res: Response) => {
  try {
    const farm = await getUserFarm(req.user!.id);
    if (!farm) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    const { salesPlatforms, shippingProfiles } = req.body;

    if (Array.isArray(salesPlatforms)) {
      await prisma.salesPlatform.deleteMany({ where: { farmId: farm.id } });
      if (salesPlatforms.length > 0) {
        await prisma.salesPlatform.createMany({
          data: salesPlatforms.map(
            (s: {
              type: string;
              shopName: string;
              feesConfig?: Record<string, unknown>;
              enabled?: boolean;
            }) => {
              const fc = s.feesConfig ?? {};
              // If feesConfig has no numeric fee fields, apply platform defaults
              const hasNumericFees = ['transactionPct', 'processingPct', 'processingFlat', 'listingFee']
                .some(k => k in fc && fc[k] !== undefined);
              const resolvedFees = hasNumericFees ? fc : (PLATFORM_FEE_DEFAULTS[s.type] ?? {});
              return {
                farmId: farm.id,
                type: s.type as any,
                shopName: s.shopName,
                feesConfig: resolvedFees as any,
                enabled: s.enabled ?? true,
              };
            }
          ),
        });
      }
    }

    if (Array.isArray(shippingProfiles)) {
      await prisma.shippingProfile.deleteMany({ where: { farmId: farm.id } });
      if (shippingProfiles.length > 0) {
        await prisma.shippingProfile.createMany({
          data: shippingProfiles.map(
            (sp: {
              name: string;
              customerPays?: number;
              postageCost?: number;
              deliveryMinDays?: number;
              deliveryMaxDays?: number;
            }) => ({
              farmId: farm.id,
              name: sp.name,
              customerPays: sp.customerPays ?? 5.99,
              postageCost: sp.postageCost ?? 5.0,
              deliveryMinDays: sp.deliveryMinDays ?? 3,
              deliveryMaxDays: sp.deliveryMaxDays ?? 5,
            })
          ),
        });
      }
    }

    const result = await prisma.farm.findUnique({
      where: { id: farm.id },
      include: { salesPlatforms: true, shippingProfiles: true },
    });

    res.json(result);
  } catch (err) {
    console.error("Wizard step3 error:", err);
    res.status(500).json({ error: "Failed to update sales & shipping" });
  }
});

// POST /step4 - Save model (manual entry)
router.post("/step4", async (req: Request, res: Response) => {
  try {
    const farm = await getUserFarm(req.user!.id);
    if (!farm) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    const {
      name,
      fileName,
      printTimeMinutes,
      filamentUsageGrams,
      filamentId,
      calculatedCost,
      suggestedPrice,
    } = req.body;

    if (!name || !fileName || printTimeMinutes == null || filamentUsageGrams == null) {
      res.status(400).json({ error: "name, fileName, printTimeMinutes, and filamentUsageGrams are required" });
      return;
    }

    const model = await prisma.model3D.create({
      data: {
        farmId: farm.id,
        name,
        fileName,
        printTimeMinutes,
        filamentUsageGrams,
        filamentId: filamentId || null,
        calculatedCost: calculatedCost ?? 0,
        suggestedPrice: suggestedPrice ?? 0,
      },
      include: { filament: true },
    });

    res.status(201).json(model);
  } catch (err) {
    console.error("Wizard step4 error:", err);
    res.status(500).json({ error: "Failed to save model" });
  }
});

// GET /status - Wizard completion status
router.get("/status", async (req: Request, res: Response) => {
  try {
    const farm = await prisma.farm.findFirst({
      where: { userId: req.user!.id },
      include: {
        taxRates: true,
        printers: true,
        filaments: true,
        salesPlatforms: true,
        shippingProfiles: true,
        models: true,
      },
    });

    if (!farm) {
      res.json({ hasFarm: false, steps: { step1: false, step2: false, step3: false, step4: false } });
      return;
    }

    res.json({
      hasFarm: true,
      farmId: farm.id,
      steps: {
        step1: farm.name !== `My Farm` && farm.name !== `${req.user!.name}'s Farm`,
        step2: farm.printers.length > 0 || farm.filaments.length > 0,
        step3: farm.salesPlatforms.length > 0 || farm.shippingProfiles.length > 0,
        step4: farm.models.length > 0,
      },
    });
  } catch (err) {
    console.error("Wizard status error:", err);
    res.status(500).json({ error: "Failed to get wizard status" });
  }
});

export default router;
