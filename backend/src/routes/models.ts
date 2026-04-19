import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
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
      include: { filament: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(models);
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
      res.json({
        fileName: req.file.originalname,
        name: path.parse(req.file.originalname).name,
        ...metadata,
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

    let { printTimeMinutes, filamentUsageGrams, filamentId } = req.body;
    let parsedPrintTime = parseFloat(printTimeMinutes) || 0;
    let parsedFilamentGrams = parseFloat(filamentUsageGrams) || 0;
    let slicer: string | null = null;

    // Auto-extract from .3mf if values not provided
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === ".3mf" && (parsedPrintTime === 0 || parsedFilamentGrams === 0)) {
      try {
        const metadata = parseThreeMF(req.file.path);
        if (parsedPrintTime === 0 && metadata.printTimeMinutes) {
          parsedPrintTime = metadata.printTimeMinutes;
        }
        if (parsedFilamentGrams === 0 && metadata.filamentUsageGrams) {
          parsedFilamentGrams = metadata.filamentUsageGrams;
        }
        slicer = metadata.slicer;
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
        printTimeMinutes: parsedPrintTime,
        filamentUsageGrams: parsedFilamentGrams,
        filamentId: filamentId || null,
        calculatedCost: 0,
        suggestedPrice: 0,
      },
      include: { filament: true },
    });

    res.status(201).json(model);
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
      include: { filament: true, farm: { include: { taxRates: true } } },
    });

    if (!model) {
      res.status(404).json({ error: "Model not found" });
      return;
    }

    // Compute pricing breakdown
    const farm = model.farm;
    const electricityCostPerHour = (farm.electricityRate * 200) / 1000; // assuming 200W printer
    const printTimeHours = model.printTimeMinutes / 60;

    const electricityCost = electricityCostPerHour * printTimeHours;
    const laborCost = (farm.laborRate / 60) * model.printTimeMinutes * 0.1; // 10% active time
    const filamentCostPerGram = model.filament
      ? model.filament.costPerSpool / model.filament.spoolWeight
      : 0.02; // fallback
    const materialCost = filamentCostPerGram * model.filamentUsageGrams;

    const baseCost = electricityCost + laborCost + materialCost;

    const totalTaxRate = farm.taxRates.reduce((sum, t) => sum + t.rate, 0) / 100;
    const taxAmount = baseCost * totalTaxRate;

    const totalCost = baseCost + taxAmount;
    const suggestedPrice = totalCost * (1 + farm.targetProfitMargin / 100);

    res.json({
      ...model,
      pricing: {
        electricityCost: +electricityCost.toFixed(2),
        laborCost: +laborCost.toFixed(2),
        materialCost: +materialCost.toFixed(2),
        baseCost: +baseCost.toFixed(2),
        taxAmount: +taxAmount.toFixed(2),
        totalCost: +totalCost.toFixed(2),
        profitMargin: farm.targetProfitMargin,
        suggestedPrice: +suggestedPrice.toFixed(2),
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
