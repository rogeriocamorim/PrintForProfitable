import { Router, Request, Response } from "express";
import prisma from "../services/prisma.js";
import { isAuthenticated } from "../middleware/auth.js";

const router = Router();
router.use(isAuthenticated);

async function getFarmId(userId: string): Promise<string | null> {
  const farm = await prisma.farm.findFirst({ where: { userId }, select: { id: true } });
  return farm?.id ?? null;
}

// GET / — list all orders for the farm
router.get("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const orders = await prisma.order.findMany({
      where: { farmId },
      include: {
        model: { select: { id: true, name: true, thumbnailPath: true, imagePath: true } },
        platform: { select: { id: true, type: true, shopName: true } },
      },
      orderBy: { orderedAt: "desc" },
    });

    res.json(orders);
  } catch (err) {
    console.error("List orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// POST / — create a new order
router.post("/", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const {
      modelId, platformId, orderNumber, customerName, customerNote,
      status, quantity, salePrice, shippingRevenue, shippingCost,
      platformFee, cogs, orderedAt,
    } = req.body;

    if (!salePrice) { res.status(400).json({ error: "salePrice is required" }); return; }

    const qty = parseInt(quantity) || 1;
    const price = parseFloat(salePrice) || 0;
    const shipRev = parseFloat(shippingRevenue) || 0;
    const shipCost = parseFloat(shippingCost) || 0;
    const fee = parseFloat(platformFee) || 0;
    const cost = parseFloat(cogs) || 0;
    const profit = (price + shipRev - shipCost - fee - cost) * qty;

    const order = await prisma.order.create({
      data: {
        farmId,
        modelId: modelId || null,
        platformId: platformId || null,
        orderNumber: orderNumber || null,
        customerName: customerName || null,
        customerNote: customerNote || null,
        status: status || "PENDING",
        quantity: qty,
        salePrice: price,
        shippingRevenue: shipRev,
        shippingCost: shipCost,
        platformFee: fee,
        cogs: cost,
        profit,
        orderedAt: orderedAt ? new Date(orderedAt) : new Date(),
      },
      include: {
        model: { select: { id: true, name: true, thumbnailPath: true, imagePath: true } },
        platform: { select: { id: true, type: true, shopName: true } },
      },
    });

    res.status(201).json(order);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// PATCH /:id — update order (status, fields)
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const orderId = String(req.params.id);
    const existing = await prisma.order.findFirst({ where: { id: orderId, farmId } });
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

    const {
      modelId, platformId, orderNumber, customerName, customerNote,
      status, quantity, salePrice, shippingRevenue, shippingCost,
      platformFee, cogs, orderedAt,
    } = req.body;

    const qty = quantity !== undefined ? parseInt(quantity) : existing.quantity;
    const price = salePrice !== undefined ? parseFloat(salePrice) : existing.salePrice;
    const shipRev = shippingRevenue !== undefined ? parseFloat(shippingRevenue) : existing.shippingRevenue;
    const shipCost = shippingCost !== undefined ? parseFloat(shippingCost) : existing.shippingCost;
    const fee = platformFee !== undefined ? parseFloat(platformFee) : existing.platformFee;
    const cost = cogs !== undefined ? parseFloat(cogs) : existing.cogs;
    const profit = (price + shipRev - shipCost - fee - cost) * qty;

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(modelId !== undefined && { modelId: modelId || null }),
        ...(platformId !== undefined && { platformId: platformId || null }),
        ...(orderNumber !== undefined && { orderNumber }),
        ...(customerName !== undefined && { customerName }),
        ...(customerNote !== undefined && { customerNote }),
        ...(status !== undefined && { status }),
        quantity: qty,
        salePrice: price,
        shippingRevenue: shipRev,
        shippingCost: shipCost,
        platformFee: fee,
        cogs: cost,
        profit,
        ...(orderedAt !== undefined && { orderedAt: new Date(orderedAt) }),
      },
      include: {
        model: { select: { id: true, name: true, thumbnailPath: true, imagePath: true } },
        platform: { select: { id: true, type: true, shopName: true } },
      },
    });

    res.json(order);
  } catch (err) {
    console.error("Update order error:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// DELETE /:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const farmId = await getFarmId(req.user!.id);
    if (!farmId) { res.status(404).json({ error: "Farm not found" }); return; }

    const orderId = String(req.params.id);
    const existing = await prisma.order.findFirst({ where: { id: orderId, farmId } });
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

    await prisma.order.delete({ where: { id: orderId } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete order error:", err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
