import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Card, CardContent } from '../../components/ui/Card'
import {
  Plus, Trash2, Loader2, ShoppingCart, Search, Edit,
  TrendingUp, DollarSign, Package, AlertCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = 'PENDING' | 'PRINTING' | 'PRINTED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'

interface OrderModel {
  id: string
  name: string
  thumbnailPath: string | null
  imagePath: string | null
}

interface OrderPlatform {
  id: string
  type: string
  shopName: string
}

interface Order {
  id: string
  orderNumber: string | null
  customerName: string | null
  customerNote: string | null
  status: OrderStatus
  quantity: number
  salePrice: number
  shippingRevenue: number
  shippingCost: number
  platformFee: number
  cogs: number
  profit: number
  orderedAt: string
  model: OrderModel | null
  platform: OrderPlatform | null
}

interface Model3DBasic {
  id: string
  name: string
  thumbnailPath: string | null
  imagePath: string | null
  suggestedPrice: number
  calculatedCost: number
}

interface SalesPlatform {
  id: string
  type: string
  shopName: string
  feesConfig: any
  enabled: boolean
}

type FormState = {
  modelId: string
  platformId: string
  orderNumber: string
  customerName: string
  customerNote: string
  status: OrderStatus
  quantity: string
  salePrice: string
  shippingRevenue: string
  shippingCost: string
  platformFee: string
  cogs: string
  orderedAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  PENDING:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  PRINTING:  { label: 'Printing',  color: 'bg-blue-100 text-blue-800 border-blue-200' },
  PRINTED:   { label: 'Printed',   color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  SHIPPED:   { label: 'Shipped',   color: 'bg-purple-100 text-purple-800 border-purple-200' },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800 border-green-200' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200' },
  REFUNDED:  { label: 'Refunded',  color: 'bg-gray-100 text-gray-600 border-gray-200' },
}

const PLATFORM_TYPE_LABELS: Record<string, string> = {
  ETSY: 'Etsy', AMAZON: 'Amazon', SHOPIFY: 'Shopify',
  TIKTOK: 'TikTok', EBAY: 'eBay', CUSTOM: 'Custom',
}

const EMPTY_FORM: FormState = {
  modelId: '', platformId: '', orderNumber: '', customerName: '',
  customerNote: '', status: 'PENDING', quantity: '1',
  salePrice: '', shippingRevenue: '0', shippingCost: '0',
  platformFee: '0', cogs: '0',
  orderedAt: new Date().toISOString().slice(0, 16),
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const m = STATUS_META[status]
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.color}`}>
      {m.label}
    </span>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [models, setModels] = useState<Model3DBasic[]>([])
  const [platforms, setPlatforms] = useState<SalesPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [showAdd, setShowAdd] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, m, p] = await Promise.all([
        api<Order[]>('/orders'),
        api<Model3DBasic[]>('/models'),
        api<SalesPlatform[]>('/platforms'),
      ])
      setOrders(o)
      setModels(m)
      setPlatforms(p.filter(p => p.enabled))
    } catch {
      setError('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-fill COGS, sale price, fees when model or platform changes
  useEffect(() => {
    if (!form.modelId) return
    // Only auto-fill when adding (not editing) — detect by editOrder being null
    // We use a ref-like pattern: only update if form was just opened
    setPricingLoading(true)
    api<any>(`/models/${form.modelId}`)
      .then(detail => {
        const pricing = detail.pricing
        if (!pricing) return

        setForm(prev => {
          // If a platform is selected, use per-platform pricing
          if (prev.platformId && pricing.platformPricing?.length) {
            const pp = pricing.platformPricing.find((p: any) => p.platformId === prev.platformId)
            if (pp) {
              return {
                ...prev,
                cogs: String(pricing.totalCost.toFixed(2)),
                salePrice: String(pp.sellingPrice.toFixed(2)),
                platformFee: String(pp.platformFees.toFixed(2)),
                shippingRevenue: String(pricing.shippingRevenue.toFixed(2)),
                shippingCost: String(pricing.shippingCost.toFixed(2)),
              }
            }
          }
          // No platform — use base COGS and suggested price
          return {
            ...prev,
            cogs: String(pricing.totalCost.toFixed(2)),
            salePrice: String(pricing.suggestedPrice.toFixed(2)),
            platformFee: '0',
            shippingRevenue: String(pricing.shippingRevenue.toFixed(2)),
            shippingCost: String(pricing.shippingCost.toFixed(2)),
          }
        })
      })
      .catch(() => {/* ignore */})
      .finally(() => setPricingLoading(false))
  }, [form.modelId, form.platformId])

  function openAdd() {
    setForm(EMPTY_FORM)
    setShowAdd(true)
  }

  function openEdit(order: Order) {
    setForm({
      modelId: order.model?.id || '',
      platformId: order.platform?.id || '',
      orderNumber: order.orderNumber || '',
      customerName: order.customerName || '',
      customerNote: order.customerNote || '',
      status: order.status,
      quantity: String(order.quantity),
      salePrice: String(order.salePrice),
      shippingRevenue: String(order.shippingRevenue),
      shippingCost: String(order.shippingCost),
      platformFee: String(order.platformFee),
      cogs: String(order.cogs),
      orderedAt: new Date(order.orderedAt).toISOString().slice(0, 16),
    })
    setEditOrder(order)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        modelId: form.modelId || null,
        platformId: form.platformId || null,
        orderNumber: form.orderNumber || null,
        customerName: form.customerName || null,
        customerNote: form.customerNote || null,
        status: form.status,
        quantity: parseInt(form.quantity) || 1,
        salePrice: parseFloat(form.salePrice) || 0,
        shippingRevenue: parseFloat(form.shippingRevenue) || 0,
        shippingCost: parseFloat(form.shippingCost) || 0,
        platformFee: parseFloat(form.platformFee) || 0,
        cogs: parseFloat(form.cogs) || 0,
        orderedAt: form.orderedAt,
      }
      if (editOrder) {
        await api(`/orders/${editOrder.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await api('/orders', { method: 'POST', body: JSON.stringify(body) })
      }
      await load()
      setShowAdd(false)
      setEditOrder(null)
    } catch {
      setError('Failed to save order')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteOrder) return
    setDeleting(true)
    try {
      await api(`/orders/${deleteOrder.id}`, { method: 'DELETE' })
      await load()
      setDeleteOrder(null)
    } catch {
      setError('Failed to delete order')
    } finally {
      setDeleting(false)
    }
  }

  async function quickStatus(order: Order, status: OrderStatus) {
    try {
      await api(`/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      await load()
    } catch { /* ignore */ }
  }

  // ─── Derived data ──────────────────────────────────────────────────────────

  const filtered = orders.filter(o => {
    const matchSearch = !search || [
      o.orderNumber, o.customerName, o.model?.name, o.platform?.shopName,
    ].some(v => v?.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: orders.length,
    revenue: orders.filter(o => o.status !== 'CANCELLED' && o.status !== 'REFUNDED')
      .reduce((s, o) => s + (o.salePrice + o.shippingRevenue) * o.quantity, 0),
    profit: orders.filter(o => o.status !== 'CANCELLED' && o.status !== 'REFUNDED')
      .reduce((s, o) => s + o.profit, 0),
    pending: orders.filter(o => o.status === 'PENDING' || o.status === 'PRINTING' || o.status === 'PRINTED').length,
  }

  // ─── Form modal content ────────────────────────────────────────────────────

  const previewProfit = (
    (parseFloat(form.salePrice) || 0) +
    (parseFloat(form.shippingRevenue) || 0) -
    (parseFloat(form.shippingCost) || 0) -
    (parseFloat(form.platformFee) || 0) -
    (parseFloat(form.cogs) || 0)
  ) * (parseInt(form.quantity) || 1)

  const formModal = (
    <Modal
      open={showAdd || !!editOrder}
      onClose={() => { setShowAdd(false); setEditOrder(null) }}
      title={editOrder ? 'Edit Order' : 'Add Order'}
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Model */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Model</label>
          <select
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            value={form.modelId}
            onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))}
          >
            <option value="">— No model —</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Platform */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Platform</label>
          <select
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            value={form.platformId}
            onChange={e => setForm(f => ({ ...f, platformId: e.target.value }))}
          >
            <option value="">— No platform —</option>
            {platforms.map(p => (
              <option key={p.id} value={p.id}>{PLATFORM_TYPE_LABELS[p.type] || p.type} — {p.shopName}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Order #" value={form.orderNumber} onChange={e => setForm(f => ({ ...f, orderNumber: e.target.value }))} placeholder="Optional" />
          <Input label="Order Date" type="datetime-local" value={form.orderedAt} onChange={e => setForm(f => ({ ...f, orderedAt: e.target.value }))} required />
        </div>

        <Input label="Customer Name" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="Optional" />
        <Input label="Customer Note" value={form.customerNote} onChange={e => setForm(f => ({ ...f, customerNote: e.target.value }))} placeholder="Optional" />

        <div className="grid grid-cols-2 gap-3">
          {/* Status */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Status</label>
            <select
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as OrderStatus }))}
            >
              {(Object.keys(STATUS_META) as OrderStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </div>
          <Input label="Quantity" type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Financials</p>
            {pricingLoading && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Loader2 className="h-3 w-3 animate-spin" /> Updating prices…
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Sale Price" type="number" step="0.01" prefix="$" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} required />
            <Input label="Shipping Revenue" type="number" step="0.01" prefix="$" value={form.shippingRevenue} onChange={e => setForm(f => ({ ...f, shippingRevenue: e.target.value }))} />
            <Input label="Shipping Cost" type="number" step="0.01" prefix="$" value={form.shippingCost} onChange={e => setForm(f => ({ ...f, shippingCost: e.target.value }))} />
            <Input label="Platform Fee" type="number" step="0.01" prefix="$" value={form.platformFee} onChange={e => setForm(f => ({ ...f, platformFee: e.target.value }))} />
            <Input label="COGS" type="number" step="0.01" prefix="$" value={form.cogs} onChange={e => setForm(f => ({ ...f, cogs: e.target.value }))} />
          </div>
        </div>

        {/* Profit preview */}
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${previewProfit >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <span className="text-sm font-medium text-foreground">Estimated Profit</span>
          <span className={`text-sm font-bold ${previewProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {fmt(previewProfit)}
          </span>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditOrder(null) }}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : editOrder ? 'Save Changes' : 'Add Order'}
          </Button>
        </div>
      </form>
    </Modal>
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-sm text-muted mt-1">Track and manage customer orders across all platforms</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Order</Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto text-red-500 hover:text-red-700" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Stats */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Orders', value: stats.total, icon: <ShoppingCart className="h-5 w-5" />, color: 'text-blue-600 bg-blue-50' },
            { label: 'Revenue', value: fmt(stats.revenue), icon: <DollarSign className="h-5 w-5" />, color: 'text-green-600 bg-green-50' },
            { label: 'Profit', value: fmt(stats.profit), icon: <TrendingUp className="h-5 w-5" />, color: stats.profit >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50' },
            { label: 'In Progress', value: stats.pending, icon: <Package className="h-5 w-5" />, color: 'text-orange-600 bg-orange-50' },
          ].map(s => (
            <Card key={s.label} className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${s.color}`}>{s.icon}</div>
                  <div>
                    <p className="text-xs text-muted">{s.label}</p>
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      {orders.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              className="w-full rounded-lg border border-border bg-white pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/20"
              placeholder="Search by order #, customer, model…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['ALL', ...Object.keys(STATUS_META)] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s as OrderStatus | 'ALL')}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-muted border-border hover:border-primary hover:text-foreground'
                }`}
              >
                {s === 'ALL' ? 'All' : STATUS_META[s as OrderStatus].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-12 w-12" />}
          title="No orders yet"
          description="Add your first order to start tracking sales, profit, and fulfillment status."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Order</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-12 w-12" />}
          title="No orders match"
          description="Try adjusting your search or status filter."
        />
      ) : (
        /* Orders table */
        <div className="rounded-xl border border-border bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  <th className="px-4 py-3 text-left font-medium text-muted">Order</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Model</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Platform</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Sale</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Profit</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(order => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onEdit={() => openEdit(order)}
                    onDelete={() => setDeleteOrder(order)}
                    onStatusChange={s => quickStatus(order, s)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formModal}

      {/* Delete confirm */}
      <Modal open={!!deleteOrder} onClose={() => setDeleteOrder(null)} title="Delete Order">
        <p className="text-sm text-muted mb-6">
          Are you sure you want to delete order <span className="font-medium text-foreground">{deleteOrder?.orderNumber || deleteOrder?.id.slice(0, 8)}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteOrder(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({
  order, onEdit, onDelete, onStatusChange,
}: {
  order: Order
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (s: OrderStatus) => void
}) {
  const thumb = order.model?.imagePath
    ? `/api/uploads/images/${order.model.imagePath}`
    : order.model?.thumbnailPath
    ? `/api/uploads/thumbnails/${order.model.thumbnailPath}`
    : null

  return (
    <tr className="hover:bg-surface-raised transition-colors">
      {/* Order # / customer */}
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">{order.orderNumber || <span className="text-muted italic">—</span>}</p>
        {order.customerName && <p className="text-xs text-muted">{order.customerName}</p>}
        {order.quantity > 1 && <p className="text-xs text-muted">Qty: {order.quantity}</p>}
      </td>

      {/* Model */}
      <td className="px-4 py-3">
        {order.model ? (
          <div className="flex items-center gap-2">
            {thumb ? (
              <img src={thumb} alt="" className="h-8 w-8 rounded object-cover border border-border shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded bg-surface-raised border border-border shrink-0 flex items-center justify-center">
                <Package className="h-4 w-4 text-muted" />
              </div>
            )}
            <span className="text-sm text-foreground truncate max-w-[140px]">{order.model.name}</span>
          </div>
        ) : (
          <span className="text-muted italic text-xs">—</span>
        )}
      </td>

      {/* Platform */}
      <td className="px-4 py-3">
        {order.platform ? (
          <div>
            <p className="text-sm font-medium text-foreground">{PLATFORM_TYPE_LABELS[order.platform.type] || order.platform.type}</p>
            <p className="text-xs text-muted">{order.platform.shopName}</p>
          </div>
        ) : (
          <span className="text-muted italic text-xs">—</span>
        )}
      </td>

      {/* Status — select to change */}
      <td className="px-4 py-3">
        <div className="relative inline-block">
          <StatusBadge status={order.status} />
          <select
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            value={order.status}
            onChange={e => onStatusChange(e.target.value as OrderStatus)}
          >
            {(Object.keys(STATUS_META) as OrderStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
      </td>

      {/* Sale */}
      <td className="px-4 py-3 text-right">
        <p className="font-medium text-foreground">{fmt(order.salePrice * order.quantity)}</p>
        {order.shippingRevenue > 0 && (
          <p className="text-xs text-muted">+{fmt(order.shippingRevenue)} ship</p>
        )}
      </td>

      {/* Profit */}
      <td className="px-4 py-3 text-right">
        <span className={`font-medium ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {fmt(order.profit)}
        </span>
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">
        {fmtDate(order.orderedAt)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <button
            className="rounded-md p-1.5 text-muted hover:bg-surface-raised hover:text-foreground transition-colors"
            onClick={onEdit}
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}
