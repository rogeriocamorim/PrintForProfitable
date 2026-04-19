import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../services/prisma";
import { isAuthenticated } from "../middleware/auth";
import { parseThreeMF } from "../services/threemf-parser";

const router = Router();
router.use(isAuthenticated);

// Multer config for .3mf uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".3mf" || ext === ".stl" || ext === ".gcode") {
      cb(null, true);
    } else {
      cb(new Error("Only .3mf, .stl, and .gcode files are allowed"));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// Helper to get user's farm ID
async function getFarmId(userId: string): Promise<string | null> {
  const farm = await prisma.farm.findFirst({
    where: { userId },
    select: { id: true },
  });
  return farm?.id ?? null;
}

// Helper to save thumbnail from .3mf parse result
function saveThumbnail(thumbnail: Buffer | null, uniquePrefix: string): string | null {
  if (!thumbnail) return null;
  const thumbnailsDir = path.join(__dirname, "../../uploads/thumbnails");
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }
  const fileName = `${uniquePrefix}.png`;
  const filePath = path.join(thumbnailsDir, fileName);
  fs.writeFileSync(filePath, thumbnail);
  return fileName;
}

// Helper to compute per-platform pricing
interface PlatformPricing {
  platformId: string;
  platformType: string;
  shopName: string;
  feesConfig: Record<string, unknown>;
  platformFees: number;
  sellingPrice: number;
  profit: number;
  profitMargin: number;
}

function computePlatformPricing(
  totalCostBeforeFees: number,
  shippingCost: number,
  shippingRevenue: number,
  targetMargin: number,
  platforms: Array<{ id: string; type: string; shopName: string; feesConfig: any; enabled: boolean }>
): PlatformPricing[] {
  return platforms
    .filter((p) => p.enabled)
    .map((p) => {
      const fees = p.feesConfig || {};
      const percentage = parseFloat(fees.percentage || "0") / 100;
      const flat = parseFloat(fees.flat || "0");

      // Total cost includes shipping cost; shipping revenue offsets the selling price needed
      // sellingPrice = (totalCost + shippingCost - shippingRevenue + flat) / (1 - percentage - margin/100)
      const marginFraction = targetMargin / 100;
      const denominator = 1 - percentage - marginFraction;
      const netShippingCost = shippingCost - shippingRevenue; // negative if customer overpays shipping
      let sellingPrice: number;

      if (denominator > 0) {
        sellingPrice = (totalCostBeforeFees + netShippingCost + flat) / denominator;
      } else {
        sellingPrice = (totalCostBeforeFees + netShippingCost) * (1 + marginFraction) + flat + totalCostBeforeFees * percentage;
      }

      // Ensure selling price is at least the cost
      if (sellingPrice < totalCostBeforeFees + netShippingCost) {
        sellingPrice = totalCostBeforeFees + netShippingCost;
      }

      const platformFees = sellingPrice * percentage + flat;
      const profit = sellingPrice - totalCostBeforeFees - netShippingCost - platformFees;

      return {
        platformId: p.id,
        platformType: p.type,
        shopName: p.shopName,
        feesConfig: fees,
        platformFees: +platformFees.toFixed(2),
        sellingPrice: +sellingPrice.toFixed(2),
        profit: +profit.toFixed(2),
        profitMargin: sellingPrice > 0 ? +(profit / sellingPrice * 100).toFixed(1) : 0,
      };
    });
}

// GET / - List all models for user's farm
router.get("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    const models = await prisma.model3D.findMany({
      where: { farmId },
      include: { filament: true, printer: true },
      orderBy: { createdAt: "desc" },
    });

    // Add thumbnail URLs
    const modelsWithUrls = models.map((m) => ({
      ...m,
      thumbnailUrl: m.thumbnailPath ? `/api/uploads/thumbnails/${m.thumbnailPath}` : null,
    }));

    res.json(modelsWithUrls);
  } catch (err) {
    console.error("List models error:", err);
    res.status(500).json({ error: "Failed to list models" });
  }
});

// POST / - Create model (manual entry)
router.post("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) {
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

    if (!name || printTimeMinutes == null || filamentUsageGrams == null) {
      res.status(400).json({
        error: "name, printTimeMinutes, and filamentUsageGrams are required",
      });
      return;
    }

    const model = await prisma.model3D.create({
      data: {
        farmId,
        name,
        fileName: fileName || "manual-entry",
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
    console.error("Create model error:", err);
    res.status(500).json({ error: "Failed to create model" });
  }
});

// POST /upload/parse - Parse .3mf file and return extracted metadata (no save)
router.post("/upload/parse", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext !== ".3mf") {
      // Non-.3mf files can't be parsed for metadata
      res.json({
        fileName: req.file.originalname,
        name: path.parse(req.file.originalname).name,
        printTimeMinutes: null,
        filamentUsageGrams: null,
        filamentType: null,
        slicer: null,
        plates: [],
        storedFileName: req.file.filename,
      });
      return;
    }

    try {
      const metadata = parseThreeMF(filePath);
      // Save thumbnail if extracted
      const thumbnailName = saveThumbnail(metadata.thumbnail, req.file.filename.replace(/\.[^.]+$/, ''));
      const { thumbnail: _thumb, ...metaWithoutBuffer } = metadata;
      res.json({
        fileName: req.file.originalname,
        name: path.parse(req.file.originalname).name,
        ...metaWithoutBuffer,
        thumbnailUrl: thumbnailName ? `/api/uploads/thumbnails/${thumbnailName}` : null,
        storedFileName: req.file.filename,
      });
    } catch (parseErr) {
      console.error("3MF parse error:", parseErr);
      // Return partial result — file was saved, just no metadata extracted
      res.json({
        fileName: req.file.originalname,
        name: path.parse(req.file.originalname).name,
        printTimeMinutes: null,
        filamentUsageGrams: null,
        filamentType: null,
        slicer: null,
        plates: [],
        storedFileName: req.file.filename,
        parseError: "Could not extract metadata from this .3mf file",
      });
    }
  } catch (err) {
    console.error("Parse upload error:", err);
    res.status(500).json({ error: "Failed to parse file" });
  }
});

// POST /upload - Handle file upload and create model (with auto-parsing)
router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    let { printTimeMinutes, filamentUsageGrams, filamentId, printerId } = req.body;
    let parsedPrintTime = parseFloat(printTimeMinutes) || 0;
    let parsedFilamentGrams = parseFloat(filamentUsageGrams) || 0;
    let slicer: string | null = null;
    let thumbnailPath: string | null = null;

    // Auto-extract from .3mf if values not provided
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === ".3mf") {
      try {
        const metadata = parseThreeMF(req.file.path);
        if (parsedPrintTime === 0 && metadata.printTimeMinutes) {
          parsedPrintTime = metadata.printTimeMinutes;
        }
        if (parsedFilamentGrams === 0 && metadata.filamentUsageGrams) {
          parsedFilamentGrams = metadata.filamentUsageGrams;
        }
        slicer = metadata.slicer;
        // Save thumbnail
        const thumbName = saveThumbnail(metadata.thumbnail, req.file.filename.replace(/\.[^.]+$/, ''));
        if (thumbName) thumbnailPath = thumbName;
      } catch (parseErr) {
        console.error("3MF auto-parse error:", parseErr);
      }
    }

    const model = await prisma.model3D.create({
      data: {
        farmId,
        name: req.body.name || path.parse(req.file.originalname).name,
        fileName: req.file.filename,
        originalFileName: req.file.originalname,
        slicer,
        thumbnailPath,
        printTimeMinutes: parsedPrintTime,
        filamentUsageGrams: parsedFilamentGrams,
        filamentId: filamentId || null,
        printerId: printerId || null,
        calculatedCost: 0,
        suggestedPrice: 0,
      },
      include: { filament: true, printer: true },
    });

    res.status(201).json({
      ...model,
      thumbnailUrl: model.thumbnailPath ? `/api/uploads/thumbnails/${model.thumbnailPath}` : null,
    });
  } catch (err) {
    console.error("Upload model error:", err);
    res.status(500).json({ error: "Failed to upload model" });
  }
});

// GET /:id - Get model detail with pricing breakdown
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    const model = await prisma.model3D.findFirst({
      where: { id: req.params.id, farmId },
      include: {
        filament: true,
        printer: true,
        farm: {
          include: {
            taxRates: true,
            salesPlatforms: true,
            printers: true,
            shippingProfiles: true,
          },
        },
      },
    });

    if (!model) {
      res.status(404).json({ error: "Model not found" });
      return;
    }

    // Compute pricing breakdown
    const farm = model.farm;

    // Use assigned printer wattage, or first farm printer, or fallback 200W
    const printerWatts = model.printer?.powerConsumption
      ?? farm.printers[0]?.powerConsumption
      ?? 200;

    const printTimeHours = model.printTimeMinutes / 60;
    const electricityCost = (farm.electricityRate * printerWatts / 1000) * printTimeHours;
    const laborCost = (farm.laborRate / 60) * (farm.prepTimeMinutes || 10); // fixed prep time, not print-time-based
    const filamentCostPerGram = model.filament
      ? model.filament.costPerSpool / model.filament.spoolWeight
      : 0.02; // fallback
    const materialCost = filamentCostPerGram * model.filamentUsageGrams;

    const baseCost = electricityCost + laborCost + materialCost;

    const totalTaxRate = farm.taxRates.reduce((sum: number, t: any) => sum + t.rate, 0) / 100;
    const taxAmount = baseCost * totalTaxRate;

    const totalCost = baseCost + taxAmount;

    // Shipping: use first shipping profile if available
    const shipping = farm.shippingProfiles[0] || null;
    const shippingCost = shipping ? shipping.postageCost : 0;
    const shippingRevenue = shipping ? shipping.customerPays : 0;

    // Base suggested price (no platform fees, no shipping)
    const suggestedPrice = totalCost * (1 + farm.targetProfitMargin / 100);

    // Per-platform pricing (includes shipping in cost basis)
    const platformPricing = computePlatformPricing(
      totalCost,
      shippingCost,
      shippingRevenue,
      farm.targetProfitMargin,
      farm.salesPlatforms
    );

    res.json({
      ...model,
      thumbnailUrl: model.thumbnailPath ? `/api/uploads/thumbnails/${model.thumbnailPath}` : null,
      pricing: {
        printerWatts,
        electricityCost: +electricityCost.toFixed(2),
        laborCost: +laborCost.toFixed(2),
        prepTimeMinutes: farm.prepTimeMinutes || 10,
        materialCost: +materialCost.toFixed(2),
        baseCost: +baseCost.toFixed(2),
        taxAmount: +taxAmount.toFixed(2),
        totalCost: +totalCost.toFixed(2),
        shippingCost: +shippingCost.toFixed(2),
        shippingRevenue: +shippingRevenue.toFixed(2),
        profitMargin: farm.targetProfitMargin,
        suggestedPrice: +suggestedPrice.toFixed(2),
        platformPricing,
      },
    });
  } catch (err) {
    console.error("Get model error:", err);
    res.status(500).json({ error: "Failed to fetch model" });
  }
});

// PUT /:id - Update model
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    const existing = await prisma.model3D.findFirst({
      where: { id: req.params.id, farmId },
    });

    if (!existing) {
      res.status(404).json({ error: "Model not found" });
      return;
    }

    const {
      name,
      printTimeMinutes,
      filamentUsageGrams,
      filamentId,
      calculatedCost,
      suggestedPrice,
    } = req.body;

    const updated = await prisma.model3D.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(printTimeMinutes !== undefined && { printTimeMinutes }),
        ...(filamentUsageGrams !== undefined && { filamentUsageGrams }),
        ...(filamentId !== undefined && { filamentId: filamentId || null }),
        ...(calculatedCost !== undefined && { calculatedCost }),
        ...(suggestedPrice !== undefined && { suggestedPrice }),
      },
      include: { filament: true },
    });

    res.json(updated);
  } catch (err) {
    console.error("Update model error:", err);
    res.status(500).json({ error: "Failed to update model" });
  }
});

// DELETE /:id - Delete model
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    const existing = await prisma.model3D.findFirst({
      where: { id: req.params.id, farmId },
    });

    if (!existing) {
      res.status(404).json({ error: "Model not found" });
      return;
    }

    await prisma.model3D.delete({ where: { id: req.params.id } });
    res.json({ message: "Model deleted" });
  } catch (err) {
    console.error("Delete model error:", err);
    res.status(500).json({ error: "Failed to delete model" });
  }
});

export default router;
