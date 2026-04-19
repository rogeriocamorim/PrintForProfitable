import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Card, CardContent } from '../../components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Plus, Trash2, Pencil, Loader2, Store } from 'lucide-react'

interface SalesPlatform {
  id: string
  type: string
  shopName: string
  feesConfig: Record<string, unknown>
  enabled: boolean
  createdAt: string
}

const PLATFORM_TYPES = ['ETSY', 'AMAZON', 'SHOPIFY', 'TIKTOK', 'EBAY', 'CUSTOM']

const platformBadge: Record<string, 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  ETSY: 'primary', AMAZON: 'warning', SHOPIFY: 'success', TIKTOK: 'danger', EBAY: 'info', CUSTOM: 'default',
}

type Country = 'US' | 'UK' | 'EU' | 'BR' | 'AU'

const COUNTRIES: { value: Country; label: string; currency: string }[] = [
  { value: 'US', label: 'United States', currency: '$' },
  { value: 'UK', label: 'United Kingdom', currency: '£' },
  { value: 'EU', label: 'Europe', currency: '€' },
  { value: 'BR', label: 'Brazil', currency: 'R$' },
  { value: 'AU', label: 'Australia', currency: 'A$' },
]

// Default fees per platform per country: { percentage: %, flat: currency amount }
// Sources: Official 2024-2025 fee schedules
const PLATFORM_DEFAULTS: Record<string, Record<Country, { percentage: string; flat: string; notes: string }>> = {
  ETSY: {
    US: { percentage: '6.5', flat: '0.20', notes: '6.5% transaction + $0.20 listing fee' },
    UK: { percentage: '6.5', flat: '0.16', notes: '6.5% transaction + £0.16 listing fee' },
    EU: { percentage: '6.5', flat: '0.18', notes: '6.5% transaction + €0.18 listing fee' },
    BR: { percentage: '6.5', flat: '1.00', notes: '6.5% transaction + R$1.00 listing fee' },
    AU: { percentage: '6.5', flat: '0.30', notes: '6.5% transaction + A$0.30 listing fee' },
  },
  AMAZON: {
    US: { percentage: '15', flat: '0.00', notes: '~15% referral fee (category avg)' },
    UK: { percentage: '15', flat: '0.00', notes: '~15% referral fee (category avg)' },
    EU: { percentage: '15', flat: '0.00', notes: '~15% referral fee (category avg)' },
    BR: { percentage: '16', flat: '0.00', notes: '~16% referral fee (category avg)' },
    AU: { percentage: '15', flat: '0.00', notes: '~15% referral fee (category avg)' },
  },
  SHOPIFY: {
    US: { percentage: '2.9', flat: '0.30', notes: 'Shopify Payments credit card fee' },
    UK: { percentage: '2.2', flat: '0.20', notes: 'Shopify Payments credit card fee' },
    EU: { percentage: '2.2', flat: '0.25', notes: 'Shopify Payments credit card fee' },
    BR: { percentage: '3.5', flat: '0.00', notes: 'Shopify Payments credit card fee' },
    AU: { percentage: '2.9', flat: '0.30', notes: 'Shopify Payments credit card fee' },
  },
  TIKTOK: {
    US: { percentage: '8', flat: '0.00', notes: '8% referral fee' },
    UK: { percentage: '5', flat: '0.00', notes: '5% referral fee' },
    EU: { percentage: '5', flat: '0.00', notes: '5% referral fee' },
    BR: { percentage: '5', flat: '0.00', notes: '5% referral fee' },
    AU: { percentage: '8', flat: '0.00', notes: '8% referral fee' },
  },
  EBAY: {
    US: { percentage: '13.25', flat: '0.30', notes: '~13.25% final value fee + $0.30/order' },
    UK: { percentage: '12.8', flat: '0.25', notes: '~12.8% final value fee + £0.25/order' },
    EU: { percentage: '11', flat: '0.35', notes: '~11% final value fee + €0.35/order' },
    BR: { percentage: '16', flat: '0.00', notes: '~16% final value fee' },
    AU: { percentage: '13.2', flat: '0.30', notes: '~13.2% final value fee + A$0.30/order' },
  },
  CUSTOM: {
    US: { percentage: '0', flat: '0.00', notes: 'Set your own fees' },
    UK: { percentage: '0', flat: '0.00', notes: 'Set your own fees' },
    EU: { percentage: '0', flat: '0.00', notes: 'Set your own fees' },
    BR: { percentage: '0', flat: '0.00', notes: 'Set your own fees' },
    AU: { percentage: '0', flat: '0.00', notes: 'Set your own fees' },
  },
}

export default function Marketplaces() {
  const [platforms, setPlatforms] = useState<SalesPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const selectClasses = "flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SalesPlatform | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type: 'ETSY', shopName: '', percentage: '6.5', flat: '0.20', country: 'US' as Country })

  useEffect(() => {
    api<SalesPlatform[]>('/platforms').then(setPlatforms).finally(() => setLoading(false))
  }, [])

  function applyDefaults(type: string, country: Country) {
    const defaults = PLATFORM_DEFAULTS[type]?.[country] ?? { percentage: '0', flat: '0.00' }
    setForm((prev) => ({ ...prev, type, country, percentage: defaults.percentage, flat: defaults.flat }))
  }

  function openAdd() {
    setEditing(null)
    const defaults = PLATFORM_DEFAULTS['ETSY']['US']
    setForm({ type: 'ETSY', shopName: '', percentage: defaults.percentage, flat: defaults.flat, country: 'US' })
    setShowModal(true)
  }

  function openEdit(p: SalesPlatform) {
    setEditing(p)
    const fees = (p.feesConfig || {}) as Record<string, string>
    setForm({
      type: p.type,
      shopName: p.shopName,
      percentage: fees.percentage ?? '0',
      flat: fees.flat ?? '0',
      country: (fees.country as Country) || 'US',
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = JSON.stringify({
        type: form.type,
        shopName: form.shopName,
        feesConfig: { percentage: form.percentage, flat: form.flat, country: form.country },
      })
      if (editing) {
        const updated = await api<SalesPlatform>(`/platforms/${editing.id}`, { method: 'PUT', body })
        setPlatforms(platforms.map((p) => p.id === updated.id ? updated : p))
      } else {
        const created = await api<SalesPlatform>('/platforms', { method: 'POST', body })
        setPlatforms([created, ...platforms])
      }
      setShowModal(false)
    } catch {
      // error
    } finally {
      setSaving(false)
    }
  }

  async function toggleEnabled(p: SalesPlatform) {
    try {
      const updated = await api<SalesPlatform>(`/platforms/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !p.enabled }),
      })
      setPlatforms(platforms.map((x) => x.id === updated.id ? updated : x))
    } catch {
      // error
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this platform?')) return
    try {
      await api(`/platforms/${id}`, { method: 'DELETE' })
      setPlatforms(platforms.filter((p) => p.id !== id))
    } catch {
      // error
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplaces</h1>
          <p className="text-sm text-muted mt-1">{platforms.length} platform{platforms.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Platform</Button>
      </div>

      {platforms.length === 0 ? (
        <Card><CardContent>
          <EmptyState
            icon={<Store className="h-12 w-12" />}
            title="No marketplaces yet"
            description="Add your sales platforms to calculate platform-specific pricing"
            action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Platform</Button>}
          />
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Platform</TableHead>
                <TableHead>Shop Name</TableHead>
                <TableHead>Fees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {platforms.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Badge variant={platformBadge[p.type] ?? 'default'}>{p.type}</Badge></TableCell>
                  <TableCell className="font-medium text-foreground">{p.shopName}</TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {((p.feesConfig as any)?.percentage ?? '0')}%
                      {parseFloat((p.feesConfig as any)?.flat ?? '0') > 0 && (
                        <span className="text-muted"> + {(p.feesConfig as any)?.flat}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => toggleEnabled(p)} className="cursor-pointer">
                      <Badge variant={p.enabled ? 'success' : 'default'}>{p.enabled ? 'Active' : 'Disabled'}</Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="rounded p-1 text-muted hover:bg-surface-raised hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(p.id)} className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Platform' : 'Add Platform'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Platform Type</label>
            <select
              className={selectClasses}
              value={form.type}
              onChange={(e) => applyDefaults(e.target.value, form.country)}
            >
              {PLATFORM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Input label="Shop Name" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} required placeholder="e.g. My Etsy Shop" />

          {/* Country / Region */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Country / Region</label>
            <select
              className={selectClasses}
              value={form.country}
              onChange={(e) => applyDefaults(form.type, e.target.value as Country)}
            >
              {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Fee fields */}
          <div className="rounded-lg border border-border bg-surface-raised p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Platform Fees</p>
              {form.type !== 'CUSTOM' && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => applyDefaults(form.type, form.country)}
                >
                  Reset to defaults
                </button>
              )}
            </div>

            {/* Fee note */}
            {PLATFORM_DEFAULTS[form.type]?.[form.country]?.notes && (
              <p className="text-xs text-muted">
                {PLATFORM_DEFAULTS[form.type][form.country].notes}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Transaction Fee"
                type="number"
                step="0.01"
                min="0"
                suffix="%"
                value={form.percentage}
                onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                required
              />
              <Input
                label="Flat Fee per Sale"
                type="number"
                step="0.01"
                min="0"
                prefix={COUNTRIES.find((c) => c.value === form.country)?.currency ?? '$'}
                value={form.flat}
                onChange={(e) => setForm({ ...form, flat: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Save' : 'Add'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
