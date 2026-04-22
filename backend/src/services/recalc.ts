import prisma from "./prisma.js";

/**
 * Recalculate all model costs that reference a given filament.
 * Updates ModelPartFilament.totalCost and Model3D.calculatedCost + suggestedPrice.
 */
export async function recalcModelsForFilament(filamentId: string): Promise<number> {
  // Find the updated filament
  const filament = await prisma.filament.findUnique({ where: { id: filamentId } });
  if (!filament) return 0;

  const costPerGram = filament.costPerSpool / filament.spoolWeight;
  console.log(`[recalc] Filament ${filamentId} updated: costPerSpool=${filament.costPerSpool}, costPerGram=${costPerGram.toFixed(4)}`);

  // Update all ModelPartFilament rows using this filament
  const partFilaments = await prisma.modelPartFilament.findMany({
    where: { filamentId },
    include: { part: true },
  });

  for (const pf of partFilaments) {
    await prisma.modelPartFilament.update({
      where: { id: pf.id },
      data: { totalCost: costPerGram * pf.grams },
    });
  }

  // Find all affected model IDs
  const modelIds = [...new Set(partFilaments.map((pf) => pf.part.modelId))];

  // Also include models that use this filament via legacy single-filament field
  const legacyModels = await prisma.model3D.findMany({
    where: { filamentId, id: { notIn: modelIds } },
    select: { id: true },
  });
  for (const m of legacyModels) modelIds.push(m.id);

  console.log(`[recalc] Recalculating ${modelIds.length} models for filament ${filamentId}`);

  // Recalculate each affected model
  for (const modelId of modelIds) {
    await recalcModelCost(modelId);
  }

  return modelIds.length;
}

/**
 * Recalculate all model costs that reference a given printer.
 */
export async function recalcModelsForPrinter(printerId: string): Promise<number> {
  // Find the printer to get its farmId
  const printer = await prisma.printer.findUnique({ where: { id: printerId }, select: { farmId: true } });
  if (!printer) return 0;

  // Find models explicitly using this printer
  const explicit = await prisma.model3D.findMany({
    where: { printerId },
    select: { id: true },
  });

  // Also find models in the same farm with no printer assigned (they use farm's first printer as fallback)
  const fallback = await prisma.model3D.findMany({
    where: { farmId: printer.farmId, printerId: null },
    select: { id: true },
  });

  const modelIds = [...new Set([...explicit, ...fallback].map(m => m.id))];

  console.log(`[recalc] Printer ${printerId} updated, recalculating ${modelIds.length} models (${explicit.length} explicit + ${fallback.length} fallback)`);

  for (const id of modelIds) {
    await recalcModelCost(id);
  }

  return modelIds.length;
}

/**
 * Recalculate a single model's calculatedCost and suggestedPrice.
 */
export async function recalcModelCost(modelId: string): Promise<void> {
  const model = await prisma.model3D.findUnique({
    where: { id: modelId },
    include: {
      filament: true,
      printer: true,
      parts: { include: { filaments: { include: { filament: true } } } },
      supplies: true,
      farm: {
        include: {
          taxRates: true,
          printers: true,
          shippingProfiles: true,
        },
      },
    },
  });

  if (!model) return;

  const farm = model.farm;
  const printer = model.printer ?? farm.printers[0] ?? null;
  const printerWatts = printer?.powerConsumption ?? 200;
  const printTimeHours = model.printTimeMinutes / 60;

  // Electricity
  const electricityCost = (farm.electricityRate * printerWatts / 1000) * printTimeHours;

  // Labor
  const prepRate = model.prepCostPerHour ?? farm.laborRate;
  const postRate = model.postCostPerHour ?? farm.laborRate;
  const prepCost = (prepRate / 60) * model.prepTimeMinutes;
  const postCost = (postRate / 60) * model.postTimeMinutes;
  const laborCost = prepCost + postCost;

  // Machinery depreciation
  const machineryCost = printer && printer.purchasePrice > 0 && printer.expectedLifetimeHours > 0
    ? (printer.purchasePrice / printer.expectedLifetimeHours) * printTimeHours
    : 0;

  // Maintenance
  const maintenanceCost = farm.maintenanceRate * printTimeHours;

  // Material cost
  let materialCost = 0;
  if (model.parts.length > 0) {
    for (const part of model.parts) {
      for (const pf of part.filaments) {
        materialCost += pf.totalCost;
      }
    }
  } else {
    const filamentCostPerGram = model.filament
      ? model.filament.costPerSpool / model.filament.spoolWeight
      : 0.02;
    materialCost = filamentCostPerGram * model.filamentUsageGrams;
  }

  // Supplies
  const suppliesCost = model.supplies.reduce((sum: number, s: { cost: number }) => sum + s.cost, 0);

  const baseCost = electricityCost + laborCost + materialCost + suppliesCost + machineryCost + maintenanceCost;

  // Tax
  const totalTaxRate = farm.taxRates.reduce((sum: number, t: { rate: number }) => sum + t.rate, 0) / 100;
  const taxAmount = baseCost * totalTaxRate;
  const totalCost = baseCost + taxAmount;

  // Suggested price using farm margin
  const margin = farm.targetProfitMargin / 100;
  const suggestedPrice = margin < 1 ? totalCost / (1 - margin) : totalCost * 2;

  console.log(`[recalc] Model ${model.name} (${modelId}): material=$${materialCost.toFixed(2)} electric=$${electricityCost.toFixed(2)} labor=$${laborCost.toFixed(2)} machinery=$${machineryCost.toFixed(2)} → cost=$${totalCost.toFixed(2)} suggested=$${suggestedPrice.toFixed(2)} (was cost=$${model.calculatedCost} suggested=$${model.suggestedPrice})`);

  await prisma.model3D.update({
    where: { id: modelId },
    data: {
      calculatedCost: Math.round(totalCost * 100) / 100,
      suggestedPrice: Math.round(suggestedPrice * 100) / 100,
    },
  });
}
