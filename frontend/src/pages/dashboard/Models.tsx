import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Card, CardContent } from '../../components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Plus, Trash2, Eye, Loader2, Box } from 'lucide-react'

interface Filament {
  id: string
  brand: string
  material: string
  variant: string
  costPerSpool: number
  spoolWeight: number
}

interface Model3D {
  id: string
  name: string
  fileName: string
  printTimeMinutes: number
  filamentUsageGrams: number
  calculatedCost: number
  suggestedPrice: number
  filament: Filament | null
  createdAt: string
}

interface PricingBreakdown {
  electricityCost: number
  laborCost: number
  materialCost: number
  baseCost: number
  taxAmount: number
  totalCost: number
  profitMargin: number
  suggestedPrice: number
}

interface ModelDetail extends Model3D {
  pricing: PricingBreakdown
}

export default function Models() {
  const [models, setModels] = useState<Model3D[]>([])
  const [filaments, setFilaments] = useState<Filament[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<ModelDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    printTimeMinutes: '',
    filamentUsageGrams: '',
    filamentId: '',
  })

  useEffect(() => {
    Promise.all([
      api<Model3D[]>('/models'),
      api<Filament[]>('/filaments'),
    ]).then(([m, f]) => {
      setModels(m)
      setFilaments(f)
    }).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const model = await api<Model3D>('/models', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          printTimeMinutes: parseFloat(form.printTimeMinutes),
          filamentUsageGrams: parseFloat(form.filamentUsageGrams),
          filamentId: form.filamentId || null,
        }),
      })
      setModels([model, ...models])
      setShowAdd(false)
      setForm({ name: '', printTimeMinutes: '', filamentUsageGrams: '', filamentId: '' })
    } catch {
      // error
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this model?')) return
    try {
      await api(`/models/${id}`, { method: 'DELETE' })
      setModels(models.filter((m) => m.id !== id))
      if (detail?.id === id) setDetail(null)
    } catch {
      // error
    }
  }

  async function viewDetail(id: string) {
    try {
      const data = await api<ModelDetail>(`/models/${id}`)
      setDetail(data)
    } catch {
      // error
    }
  }

  function formatTime(minutes: number) {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">3D Models</h1>
          <p className="text-sm text-muted mt-1">{models.length} model{models.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add Model
        </Button>
      </div>

      {models.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Box className="h-12 w-12" />}
              title="No models yet"
              description="Add your first 3D model to see pricing calculations"
              action={<Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Model</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Name</TableHead>
                <TableHead>Print Time</TableHead>
                <TableHead>Filament</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-medium text-gray-900">{model.name}</TableCell>
                  <TableCell>{formatTime(model.printTimeMinutes)}</TableCell>
                  <TableCell>{model.filamentUsageGrams}g</TableCell>
                  <TableCell>
                    {model.filament ? (
                      <Badge variant="info">{model.filament.material}</Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">${model.calculatedCost.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium text-primary">${model.suggestedPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => viewDetail(model.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(model.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Model Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Model">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Model Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Print Time (minutes)"
            type="number"
            step="1"
            suffix="min"
            value={form.printTimeMinutes}
            onChange={(e) => setForm({ ...form, printTimeMinutes: e.target.value })}
            required
          />
          <Input
            label="Filament Usage"
            type="number"
            step="0.1"
            suffix="grams"
            value={form.filamentUsageGrams}
            onChange={(e) => setForm({ ...form, filamentUsageGrams: e.target.value })}
            required
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Filament</label>
            <select
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={form.filamentId}
              onChange={(e) => setForm({ ...form, filamentId: e.target.value })}
            >
              <option value="">None (use default cost)</option>
              {filaments.map((f) => (
                <option key={f.id} value={f.id}>{f.brand} {f.material} - {f.variant}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Add Model
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Pricing Breakdown" className="max-w-md">
        {detail && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">{detail.name}</h3>
              <p className="text-sm text-muted">{formatTime(detail.printTimeMinutes)} &middot; {detail.filamentUsageGrams}g</p>
            </div>
            <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Material Cost</span>
                <span>${detail.pricing.materialCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Electricity Cost</span>
                <span>${detail.pricing.electricityCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Labor Cost</span>
                <span>${detail.pricing.laborCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-muted">Base Cost</span>
                <span className="font-medium">${detail.pricing.baseCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tax</span>
                <span>${detail.pricing.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Cost</span>
                <span className="font-medium">${detail.pricing.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-muted">Profit Margin</span>
                <span>{detail.pricing.profitMargin}%</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-primary">
                <span>Suggested Price</span>
                <span>${detail.pricing.suggestedPrice.toFixed(2)}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setDetail(null)}>Close</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
