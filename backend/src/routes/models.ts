import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import prisma from "../services/prisma.js";
import { isAuthenticated } from "../middleware/auth.js";
import { parseThreeMF } from "../services/threemf-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      // Use pre-computed totals, or fall back to granular fee fields
      const percentage = parseFloat(fees.percentage || "0") ||
        ((parseFloat(fees.transactionPct || "0") + parseFloat(fees.processingPct || "0")));
      const flat = parseFloat(fees.flat || "0") ||
        ((parseFloat(fees.processingFlat || "0") + parseFloat(fees.listingFee || "0")));
      const pctFraction = percentage / 100;

      // Total cost includes shipping cost; shipping revenue offsets the selling price needed
      // sellingPrice = (totalCost + shippingCost - shippingRevenue + flat) / (1 - pctFraction - margin/100)
      const marginFraction = targetMargin / 100;
      const denominator = 1 - pctFraction - marginFraction;
      const netShippingCost = shippingCost - shippingRevenue; // negative if customer overpays shipping
      let sellingPrice: number;

      if (denominator > 0) {
        sellingPrice = (totalCostBeforeFees + netShippingCost + flat) / denominator;
      } else {
        sellingPrice = (totalCostBeforeFees + netShippingCost) * (1 + marginFraction) + flat + totalCostBeforeFees * pctFraction;
      }

      // Ensure selling price is at least the cost
      if (sellingPrice < totalCostBeforeFees + netShippingCost) {
        sellingPrice = totalCostBeforeFees + netShippingCost;
      }

      const platformFees = sellingPrice * pctFraction + flat;
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
      include: {
        filament: true,
        printer: true,
        parts: { include: { filaments: true } },
        supplies: true,
        skus: true,
        farm: {
          include: {
            taxRates: true,
            salesPlatforms: true,
            printers: true,
            shippingProfiles: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute pricing summary for each model
    const modelsWithPricing = models.map((m) => {
      const farm = m.farm;
      const printer = m.printer ?? farm.printers[0] ?? null;
      const printerWatts = printer?.powerConsumption ?? 200;
      const printTimeHours = m.printTimeMinutes / 60;
      const qty = Math.max(1, m.buildPlateQty ?? 1);

      // Per-plate totals (for the whole print run)
      const electricityCostPlate = (farm.electricityRate * printerWatts / 1000) * printTimeHours;
      const prepRate = m.prepCostPerHour ?? farm.laborRate;
      const postRate = m.postCostPerHour ?? farm.laborRate;
      const prepCostPlate = (prepRate / 60) * m.prepTimeMinutes;
      const postCostPlate = (postRate / 60) * m.postTimeMinutes;
      const laborCostPlate = prepCostPlate + postCostPlate;

      const machineryCostPlate = printer && printer.purchasePrice > 0 && printer.expectedLifetimeHours > 0
        ? (printer.purchasePrice / printer.expectedLifetimeHours) * printTimeHours
        : 0;

      const maintenanceCostPlate = farm.maintenanceRate * printTimeHours;

      let materialCostPlate = 0;
      if (m.parts.length > 0) {
        for (const part of m.parts) {
          for (const pf of part.filaments) {
            materialCostPlate += pf.totalCost;
          }
        }
      } else {
        const filamentCostPerGram = m.filament ? m.filament.costPerSpool / m.filament.spoolWeight : 0.02;
        materialCostPlate = filamentCostPerGram * m.filamentUsageGrams;
      }

      const suppliesCostPlate = m.supplies.reduce((sum, s) => sum + s.cost, 0);

      // Per-item costs: divide everything by buildPlateQty
      const electricityCost = electricityCostPlate / qty;
      const laborCost = laborCostPlate / qty;
      const machineryCost = machineryCostPlate / qty;
      const maintenanceCost = maintenanceCostPlate / qty;
      const materialCost = materialCostPlate / qty;
      const suppliesCost = suppliesCostPlate / qty;

      const baseCost = electricityCost + laborCost + materialCost + suppliesCost + machineryCost + maintenanceCost;
      const totalTaxRate = farm.taxRates.reduce((sum: number, t: any) => sum + t.rate, 0) / 100;
      const taxAmount = baseCost * totalTaxRate;
      const totalCost = baseCost + taxAmount;

      const shipping = farm.shippingProfiles[0] || null;
      const shippingCost = shipping ? shipping.postageCost : 0;
      const shippingRevenue = shipping ? shipping.customerPays : 0;

      const platformPricing = computePlatformPricing(totalCost, shippingCost, shippingRevenue, farm.targetProfitMargin, farm.salesPlatforms);

      // Avg across platforms for list display
      const avgSellingPrice = platformPricing.length > 0 ? platformPricing.reduce((s, p) => s + p.sellingPrice, 0) / platformPricing.length : totalCost * (1 + farm.targetProfitMargin / 100);
      const avgProfit = platformPricing.length > 0 ? platformPricing.reduce((s, p) => s + p.profit, 0) / platformPricing.length : avgSellingPrice - totalCost;
      const avgProfitMargin = platformPricing.length > 0 ? platformPricing.reduce((s, p) => s + p.profitMargin, 0) / platformPricing.length : farm.targetProfitMargin;
      const profitPerHour = printTimeHours > 0 ? avgProfit / printTimeHours : 0;

      const { farm: _farm, parts: _parts, supplies: _supplies, ...modelData } = m;
      return {
        ...modelData,
        thumbnailUrl: m.thumbnailPath ? `/api/uploads/thumbnails/${m.thumbnailPath}` : null,
        pricingSummary: {
          totalCost: +totalCost.toFixed(2),
          avgSellingPrice: +avgSellingPrice.toFixed(2),
          avgProfit: +avgProfit.toFixed(2),
          avgProfitPerHour: +profitPerHour.toFixed(2),
          avgProfitMargin: +avgProfitMargin.toFixed(1),
          shippingCost: +shippingCost.toFixed(2),
          machineryCost: +machineryCost.toFixed(2),
          maintenanceCost: +maintenanceCost.toFixed(2),
          buildPlateQty: qty,
          platformPricing,
        },
      };
    });

    res.json(modelsWithPricing);
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

      if (metadata.isUnsliced) {
        // Clean up the uploaded file — no point keeping an unsliced 3mf
        fs.unlink(filePath, () => {});
        res.status(422).json({
          error: "This file has not been sliced yet. Please open it in your slicer (BambuStudio, PrusaSlicer, OrcaSlicer, etc.), slice it, and export the sliced .3mf file.",
          isUnsliced: true,
        });
        return;
      }

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
    let plates: Array<{ index: number; printTimeMinutes: number; filamentUsageGrams: number; filaments: Array<{ id: number; type: string; color: string; usedGrams: number; usedMeters: number }> }> = [];
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
        plates = metadata.plates;
        // Save thumbnail
        const thumbName = saveThumbnail(metadata.thumbnail, req.file.filename.replace(/\.[^.]+$/, ''));
        if (thumbName) thumbnailPath = thumbName;
      } catch (parseErr) {
        console.error("3MF auto-parse error:", parseErr);
      }
    }

    // Get farm filaments for auto-matching
    const farmFilaments = await prisma.filament.findMany({ where: { farmId } });

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
        // Create parts from parsed plate data
        parts: plates.length > 0 ? {
          create: plates.map((plate, idx) => ({
            name: `Plate ${plate.index}`,
            sortOrder: idx,
            filaments: {
              create: plate.filaments.map((f) => {
                // Try to auto-match farm filament by type
                const matchedFilament = farmFilaments.find(
                  (ff) => ff.material.toLowerCase() === f.type.toLowerCase()
                );
                const costPerGram = matchedFilament
                  ? matchedFilament.costPerSpool / matchedFilament.spoolWeight
                  : 0.02; // default cost
                return {
                  name: `${f.type}${f.color ? ` (${f.color})` : ''}`,
                  filamentId: matchedFilament?.id || null,
                  grams: f.usedGrams,
                  totalCost: Math.round(f.usedGrams * costPerGram * 100) / 100,
                };
              }),
            },
          })),
        } : undefined,
      },
      include: {
        filament: true,
        printer: true,
        parts: { include: { filaments: true } },
      },
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
      where: { id: req.params.id as string, farmId },
      include: {
        filament: true,
        printer: true,
        skus: true,
        parts: {
          include: { filaments: { include: { filament: true } } },
          orderBy: { sortOrder: "asc" },
        },
        supplies: true,
        platformAssignments: {
          include: {
            platform: true,
            shippingProfile: true,
          },
        },
        farm: {
          include: {
            taxRates: true,
            salesPlatforms: true,
            printers: true,
            shippingProfiles: true,
            filaments: true,
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

    // Use assigned printer, or first farm printer, or fallback
    const printer = model.printer ?? farm.printers[0] ?? null;
    const printerWatts = printer?.powerConsumption ?? 200;

    const printTimeHours = model.printTimeMinutes / 60;
    const qty = Math.max(1, model.buildPlateQty ?? 1);

    // Per-plate totals
    const electricityCostPlate = (farm.electricityRate * printerWatts / 1000) * printTimeHours;

    // Labor: model-level prep/post times and rates (fall back to farm defaults)
    const prepRate = model.prepCostPerHour ?? farm.laborRate;
    const postRate = model.postCostPerHour ?? farm.laborRate;
    const prepCostPlate = (prepRate / 60) * model.prepTimeMinutes;
    const postCostPlate = (postRate / 60) * model.postTimeMinutes;
    const laborCostPlate = prepCostPlate + postCostPlate;

    // Machinery depreciation: (purchasePrice / lifetimeHours) * printHours
    const machineryCostPlate = printer && printer.purchasePrice > 0 && printer.expectedLifetimeHours > 0
      ? (printer.purchasePrice / printer.expectedLifetimeHours) * printTimeHours
      : 0;

    // Maintenance: maintenanceRate * printHours
    const maintenanceCostPlate = farm.maintenanceRate * printTimeHours;

    // Filament cost: from parts if available, otherwise legacy single-filament
    let materialCostPlate = 0;
    if (model.parts.length > 0) {
      for (const part of model.parts) {
        for (const pf of part.filaments) {
          materialCostPlate += pf.totalCost;
        }
      }
    } else {
      const filamentCostPerGram = model.filament
        ? model.filament.costPerSpool / model.filament.spoolWeight
        : 0.02;
      materialCostPlate = filamentCostPerGram * model.filamentUsageGrams;
    }

    // Supplies cost (per plate)
    const suppliesCostPlate = model.supplies.reduce((sum, s) => sum + s.cost, 0);

    // Per-item costs: divide everything by buildPlateQty
    const electricityCost = electricityCostPlate / qty;
    const prepCost = prepCostPlate / qty;
    const postCost = postCostPlate / qty;
    const laborCost = laborCostPlate / qty;
    const machineryCost = machineryCostPlate / qty;
    const maintenanceCost = maintenanceCostPlate / qty;
    const materialCost = materialCostPlate / qty;
    const suppliesCost = suppliesCostPlate / qty;

    const baseCost = electricityCost + laborCost + materialCost + suppliesCost + machineryCost + maintenanceCost;

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
        buildPlateQty: qty,
        electricityCost: +electricityCost.toFixed(2),
        laborCost: +laborCost.toFixed(2),
        prepCost: +prepCost.toFixed(2),
        postCost: +postCost.toFixed(2),
        machineryCost: +machineryCost.toFixed(2),
        maintenanceCost: +maintenanceCost.toFixed(2),
        materialCost: +materialCost.toFixed(2),
        suppliesCost: +suppliesCost.toFixed(2),
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

// PUT /:id - Update model (full edit)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) {
      res.status(404).json({ error: "Farm not found" });
      return;
    }

    const existing = await prisma.model3D.findFirst({
      where: { id: req.params.id as string, farmId },
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
      printerId,
      calculatedCost,
      suggestedPrice,
      category,
      buildPlateQty,
      designer,
      marketplaceName,
      hasVariations,
      hasPersonalization,
      prepTimeMinutes,
      prepCostPerHour,
      postTimeMinutes,
      postCostPerHour,
      // Related data
      skus,
      parts,
      supplies,
      platformAssignments,
    } = req.body;

    // Update model scalar fields
    const updated = await prisma.model3D.update({
      where: { id: req.params.id as string },
      data: {
        ...(name !== undefined && { name }),
        ...(printTimeMinutes !== undefined && { printTimeMinutes }),
        ...(filamentUsageGrams !== undefined && { filamentUsageGrams }),
        ...(filamentId !== undefined && { filamentId: filamentId || null }),
        ...(printerId !== undefined && { printerId: printerId || null }),
        ...(calculatedCost !== undefined && { calculatedCost }),
        ...(suggestedPrice !== undefined && { suggestedPrice }),
        ...(category !== undefined && { category: category || null }),
        ...(buildPlateQty !== undefined && { buildPlateQty }),
        ...(designer !== undefined && { designer: designer || null }),
        ...(marketplaceName !== undefined && { marketplaceName: marketplaceName || null }),
        ...(hasVariations !== undefined && { hasVariations }),
        ...(hasPersonalization !== undefined && { hasPersonalization }),
        ...(prepTimeMinutes !== undefined && { prepTimeMinutes }),
        ...(prepCostPerHour !== undefined && { prepCostPerHour: prepCostPerHour || null }),
        ...(postTimeMinutes !== undefined && { postTimeMinutes }),
        ...(postCostPerHour !== undefined && { postCostPerHour: postCostPerHour || null }),
      },
    });

    // Update SKUs (replace all)
    if (skus !== undefined) {
      await prisma.modelSku.deleteMany({ where: { modelId: req.params.id as string } });
      if (skus.length > 0) {
        await prisma.modelSku.createMany({
          data: skus.map((s: { sku: string }) => ({
            modelId: req.params.id as string,
            sku: s.sku,
          })),
        });
      }
    }

    // Update Parts & Filaments (replace all)
    if (parts !== undefined) {
      // Delete existing parts (cascades to filaments)
      await prisma.modelPart.deleteMany({ where: { modelId: req.params.id as string } });
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const createdPart = await prisma.modelPart.create({
          data: {
            modelId: req.params.id as string,
            name: p.name || `Plate ${i + 1}`,
            sortOrder: i,
          },
        });
        if (p.filaments && p.filaments.length > 0) {
          await prisma.modelPartFilament.createMany({
            data: p.filaments.map((f: any) => ({
              partId: createdPart.id,
              name: f.name,
              filamentId: f.filamentId || null,
              grams: f.grams,
              totalCost: f.totalCost,
            })),
          });
        }
      }
    }

    // Update Supplies (replace all)
    if (supplies !== undefined) {
      await prisma.modelSupply.deleteMany({ where: { modelId: req.params.id as string } });
      if (supplies.length > 0) {
        await prisma.modelSupply.createMany({
          data: supplies.map((s: { name: string; cost: number }) => ({
            modelId: req.params.id as string,
            name: s.name,
            cost: s.cost,
          })),
        });
      }
    }

    // Update Platform Assignments (replace all)
    if (platformAssignments !== undefined) {
      await prisma.modelPlatformAssignment.deleteMany({ where: { modelId: req.params.id as string } });
      if (platformAssignments.length > 0) {
        await prisma.modelPlatformAssignment.createMany({
          data: platformAssignments.map((a: any) => ({
            modelId: req.params.id as string,
            platformId: a.platformId,
            shippingProfileId: a.shippingProfileId || null,
            enabled: a.enabled !== false,
          })),
        });
      }
    }

    // Return full model with all relations
    const fullModel = await prisma.model3D.findUnique({
      where: { id: req.params.id as string },
      include: {
        filament: true,
        printer: true,
        skus: true,
        parts: {
          include: { filaments: { include: { filament: true } } },
          orderBy: { sortOrder: "asc" },
        },
        supplies: true,
        platformAssignments: {
          include: { platform: true, shippingProfile: true },
        },
      },
    });

    res.json(fullModel);
  } catch (err) {
    console.error("Update model error:", err);
    res.status(500).json({ error: "Failed to update model" });
  }
});

// POST /:id/image - Upload model image
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(__dirname, "../../uploads/images");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post("/:id/image", imageUpload.single("image"), async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId || !req.file) {
      res.status(400).json({ error: "No file uploaded or farm not found" });
      return;
    }
    const model = await prisma.model3D.update({
      where: { id: req.params.id as string },
      data: { imagePath: req.file.filename },
    });
    res.json({ imagePath: model.imagePath, imageUrl: `/api/uploads/images/${model.imagePath}` });
  } catch (err) {
    console.error("Upload image error:", err);
    res.status(500).json({ error: "Failed to upload image" });
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
      where: { id: req.params.id as string, farmId },
    });

    if (!existing) {
      res.status(404).json({ error: "Model not found" });
      return;
    }

    await prisma.model3D.delete({ where: { id: req.params.id as string } });
    res.json({ message: "Model deleted" });
  } catch (err) {
    console.error("Delete model error:", err);
    res.status(500).json({ error: "Failed to delete model" });
  }
});

export default router;
