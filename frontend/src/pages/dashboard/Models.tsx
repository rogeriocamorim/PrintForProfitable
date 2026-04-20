import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../lib/api'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  Plus, Trash2, Eye, Loader2, Box, Upload, FileUp, CheckCircle, AlertCircle,
  Image as ImageIcon, Store, ArrowLeft, ChevronDown, ChevronUp, Info,
} from 'lucide-react'

// ─── Interfaces ──────────────────────────────────────
interface Filament {
  id: string
  brand: string
  material: string
  variant: string
  costPerSpool: number
  spoolWeight: number
}

interface Printer {
  id: string
  brand: string
  model: string
  powerConsumption: number
}

interface SalesPlatform {
  id: string
  type: string
  shopName: string
  feesConfig: any
  enabled: boolean
}

interface ShippingProfile {
  id: string
  name: string
  customerPays: number
  postageCost: number
}

interface ModelSku {
  id: string
  sku: string
}

interface ModelPartFilament {
  id?: string
  name: string
  filamentId: string | null
  filament?: Filament | null
  grams: number
  totalCost: number
}

interface ModelPart {
  id?: string
  name: string
  sortOrder: number
  filaments: ModelPartFilament[]
}

interface ModelSupply {
  id?: string
  name: string
  cost: number
}

interface ModelPlatformAssignment {
  id?: string
  platformId: string
  platform?: SalesPlatform
  shippingProfileId: string | null
  shippingProfile?: ShippingProfile | null
  enabled: boolean
}

interface PlatformPricing {
  platformId: string
  platformType: string
  shopName: string
  platformFees: number
  sellingPrice: number
  profit: number
  profitMargin: number
}

interface PricingBreakdown {
  printerWatts: number
  electricityCost: number
  laborCost: number
  prepCost: number
  postCost: number
  materialCost: number
  suppliesCost: number
  baseCost: number
  taxAmount: number
  totalCost: number
  shippingCost: number
  shippingRevenue: number
  profitMargin: number
  suggestedPrice: number
  platformPricing: PlatformPricing[]
}

interface Model3D {
  id: string
  name: string
  fileName: string
  originalFileName: string | null
  slicer: string | null
  thumbnailUrl: string | null
  imagePath: string | null
  category: string | null
  buildPlateQty: number
  designer: string | null
  marketplaceName: string | null
  hasVariations: boolean
  hasPersonalization: boolean
  printTimeMinutes: number
  filamentUsageGrams: number
  printerId: string | null
  filamentId: string | null
  prepTimeMinutes: number
  prepCostPerHour: number | null
  postTimeMinutes: number
  postCostPerHour: number | null
  calculatedCost: number
  suggestedPrice: number
  filament: Filament | null
  printer: Printer | null
  createdAt: string
}

interface ModelDetail extends Model3D {
  skus: ModelSku[]
  parts: ModelPart[]
  supplies: ModelSupply[]
  platformAssignments: ModelPlatformAssignment[]
  pricing: PricingBreakdown
  farm: {
    laborRate: number
    electricityRate: number
    prepTimeMinutes: number
    printers: Printer[]
    filaments: Filament[]
    salesPlatforms: SalesPlatform[]
    shippingProfiles: ShippingProfile[]
  }
}

interface ParseResult {
  fileName: string
  name: string
  printTimeMinutes: number | null
  filamentUsageGrams: number | null
  filamentType: string | null
  slicer: string | null
  thumbnailUrl: string | null
  storedFileName: string
  parseError?: string
}

// ─── Edit Form State ─────────────────────────────────
interface EditFormState {
  name: string
  category: string
  buildPlateQty: number
  printHours: string
  printMinutes: string
  designer: string
  marketplaceName: string
  hasVariations: boolean
  hasPersonalization: boolean
  printerId: string
  prepTimeMinutes: string
  prepCostPerHour: string
  postTimeMinutes: string
  postCostPerHour: string
  skus: { sku: string }[]
  parts: {
    name: string
    filaments: { name: string; filamentId: string; grams: string; totalCost: string }[]
  }[]
  supplies: { name: string; cost: string }[]
  platformAssignments: { platformId: string; shippingProfileId: string; enabled: boolean }[]
}

// ─── Component ───────────────────────────────────────
export default function Models() {
  const [models, setModels] = useState<Model3D[]>([])
  const [filaments, setFilaments] = useState<Filament[]>([])
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<ModelDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'manual' | 'upload'>('upload')
  const [uploading, setUploading] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '',
    printTimeMinutes: '',
    filamentUsageGrams: '',
    filamentId: '',
    printerId: '',
  })

  // Edit form state
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  const [expandedParts, setExpandedParts] = useState<Set<number>>(new Set([0]))

  useEffect(() => {
    Promise.all([
      api<Model3D[]>('/models'),
      api<Filament[]>('/filaments'),
      api<Printer[]>('/printers'),
    ]).then(([m, f, p]) => {
      setModels(m)
      setFilaments(f)
      setPrinters(p)
    }).finally(() => setLoading(false))
  }, [])

  function resetForm() {
    setAddForm({ name: '', printTimeMinutes: '', filamentUsageGrams: '', filamentId: '', printerId: '' })
    setParseResult(null)
    setMode('upload')
    setDragOver(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (fileInputRef.current) {
      const dt = new DataTransfer()
      dt.items.add(file)
      fileInputRef.current.files = dt.files
    }
    processFile(file)
  }

  async function processFile(file: File) {
    setUploading(true)
    setParseResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/models/upload/parse', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      const result: ParseResult = await res.json()
      setParseResult(result)
      setAddForm((prev) => ({
        ...prev,
        name: result.name || prev.name,
        printTimeMinutes: result.printTimeMinutes != null ? String(Math.round(result.printTimeMinutes)) : prev.printTimeMinutes,
        filamentUsageGrams: result.filamentUsageGrams != null ? String(Math.round(result.filamentUsageGrams * 100) / 100) : prev.filamentUsageGrams,
      }))
      if (result.filamentType && filaments.length > 0) {
        const match = filaments.find((f) => f.material.toLowerCase() === result.filamentType!.toLowerCase())
        if (match) setAddForm((prev) => ({ ...prev, filamentId: match.id }))
      }
    } catch { /* error */ } finally { setUploading(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      let model: Model3D
      if (mode === 'upload' && parseResult) {
        const formData = new FormData()
        const fileInput = fileInputRef.current
        if (fileInput?.files?.[0]) formData.append('file', fileInput.files[0])
        formData.append('name', addForm.name)
        formData.append('printTimeMinutes', addForm.printTimeMinutes)
        formData.append('filamentUsageGrams', addForm.filamentUsageGrams)
        if (addForm.filamentId) formData.append('filamentId', addForm.filamentId)
        if (addForm.printerId) formData.append('printerId', addForm.printerId)
        const token = localStorage.getItem('token')
        const res = await fetch('/api/models/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })
        if (!res.ok) throw new Error('Upload failed')
        model = await res.json()
      } else {
        model = await api<Model3D>('/models', {
          method: 'POST',
          body: JSON.stringify({
            name: addForm.name,
            printTimeMinutes: parseFloat(addForm.printTimeMinutes),
            filamentUsageGrams: parseFloat(addForm.filamentUsageGrams),
            filamentId: addForm.filamentId || null,
            printerId: addForm.printerId || null,
          }),
        })
      }
      setModels([model, ...models])
      setShowAdd(false)
      resetForm()
    } catch { /* error */ } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this model?')) return
    try {
      await api(`/models/${id}`, { method: 'DELETE' })
      setModels(models.filter((m) => m.id !== id))
      if (detail?.id === id) { setDetail(null); setEditForm(null) }
    } catch { /* error */ }
  }

  // Load model detail and initialize edit form
  async function openEditModel(id: string) {
    try {
      const data = await api<ModelDetail>(`/models/${id}`)
      setDetail(data)
      initEditForm(data)
    } catch { /* error */ }
  }

  function initEditForm(d: ModelDetail) {
    const totalMinutes = d.printTimeMinutes
    const hours = Math.floor(totalMinutes / 60)
    const mins = Math.round(totalMinutes % 60)

    const farmFilaments = d.farm?.filaments || filaments

    setEditForm({
      name: d.name,
      category: d.category || '',
      buildPlateQty: d.buildPlateQty,
      printHours: String(hours),
      printMinutes: String(mins),
      designer: d.designer || '',
      marketplaceName: d.marketplaceName || '',
      hasVariations: d.hasVariations,
      hasPersonalization: d.hasPersonalization,
      printerId: d.printerId || '',
      prepTimeMinutes: String(d.prepTimeMinutes),
      prepCostPerHour: String(d.prepCostPerHour ?? d.farm?.laborRate ?? 60),
      postTimeMinutes: String(d.postTimeMinutes),
      postCostPerHour: String(d.postCostPerHour ?? d.farm?.laborRate ?? 60),
      skus: d.skus.length > 0 ? d.skus.map((s) => ({ sku: s.sku })) : [],
      parts: d.parts.length > 0
        ? d.parts.map((p) => ({
            name: p.name,
            filaments: p.filaments.map((f) => ({
              name: f.name,
              filamentId: f.filamentId || '',
              grams: String(f.grams),
              totalCost: String(f.totalCost),
            })),
          }))
        : [{
            name: 'Plate 1',
            filaments: d.filamentUsageGrams > 0
              ? [{
                  name: d.filament ? `${d.filament.material}` : 'Default',
                  filamentId: d.filamentId || '',
                  grams: String(d.filamentUsageGrams),
                  totalCost: String(d.filament ? (d.filament.costPerSpool / d.filament.spoolWeight * d.filamentUsageGrams).toFixed(2) : '0'),
                }]
              : [],
          }],
      supplies: d.supplies.map((s) => ({ name: s.name, cost: String(s.cost) })),
      platformAssignments: d.farm?.salesPlatforms.map((sp) => {
        const existing = d.platformAssignments.find((a) => a.platformId === sp.id)
        return {
          platformId: sp.id,
          shippingProfileId: existing?.shippingProfileId || '',
          enabled: existing?.enabled ?? false,
        }
      }) || [],
    })
    setExpandedParts(new Set([0]))
  }

  // Recalculate filament total when grams or filament selection changes
  function recalcFilamentCost(partIdx: number, filIdx: number, field: 'grams' | 'filamentId', value: string) {
    if (!editForm) return
    const newParts = [...editForm.parts]
    const fil = { ...newParts[partIdx].filaments[filIdx] }

    if (field === 'grams') fil.grams = value
    else fil.filamentId = value

    // Auto-compute totalCost from grams * cost per gram
    const grams = parseFloat(fil.grams) || 0
    const allFils = detail?.farm?.filaments || filaments
    const selectedFilament = allFils.find((f) => f.id === fil.filamentId)
    if (selectedFilament && grams > 0) {
      fil.totalCost = ((selectedFilament.costPerSpool / selectedFilament.spoolWeight) * grams).toFixed(2)
    }

    newParts[partIdx] = {
      ...newParts[partIdx],
      filaments: newParts[partIdx].filaments.map((f, i) => i === filIdx ? fil : f),
    }
    setEditForm({ ...editForm, parts: newParts })
  }

  // Save edit form
  async function handleSaveEdit() {
    if (!detail || !editForm) return
    setSaving(true)
    try {
      const printTimeMinutes = (parseInt(editForm.printHours) || 0) * 60 + (parseInt(editForm.printMinutes) || 0)
      const totalFilamentGrams = editForm.parts.reduce((sum, p) =>
        sum + p.filaments.reduce((s, f) => s + (parseFloat(f.grams) || 0), 0), 0
      )

      await api(`/models/${detail.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name,
          category: editForm.category || null,
          buildPlateQty: editForm.buildPlateQty,
          printTimeMinutes,
          filamentUsageGrams: totalFilamentGrams,
          designer: editForm.designer || null,
          marketplaceName: editForm.marketplaceName || null,
          hasVariations: editForm.hasVariations,
          hasPersonalization: editForm.hasPersonalization,
          printerId: editForm.printerId || null,
          prepTimeMinutes: parseFloat(editForm.prepTimeMinutes) || 1,
          prepCostPerHour: parseFloat(editForm.prepCostPerHour) || null,
          postTimeMinutes: parseFloat(editForm.postTimeMinutes) || 1,
          postCostPerHour: parseFloat(editForm.postCostPerHour) || null,
          skus: editForm.skus.filter((s) => s.sku.trim()),
          parts: editForm.parts.map((p) => ({
            name: p.name,
            filaments: p.filaments.map((f) => ({
              name: f.name,
              filamentId: f.filamentId || null,
              grams: parseFloat(f.grams) || 0,
              totalCost: parseFloat(f.totalCost) || 0,
            })),
          })),
          supplies: editForm.supplies.filter((s) => s.name.trim()).map((s) => ({
            name: s.name,
            cost: parseFloat(s.cost) || 0,
          })),
          platformAssignments: editForm.platformAssignments
            .filter((a) => a.enabled)
            .map((a) => ({
              platformId: a.platformId,
              shippingProfileId: a.shippingProfileId || null,
              enabled: true,
            })),
        }),
      })

      // Reload model detail and list
      const [updatedDetail, updatedModels] = await Promise.all([
        api<ModelDetail>(`/models/${detail.id}`),
        api<Model3D[]>('/models'),
      ])
      setDetail(updatedDetail)
      initEditForm(updatedDetail)
      setModels(updatedModels)
    } catch { /* error */ } finally { setSaving(false) }
  }

  function formatTime(minutes: number) {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  // Computed costs from edit form
  const computedCosts = useCallback(() => {
    if (!editForm || !detail) return { filament: 0, print: 0, labor: 0, supplies: 0, total: 0 }

    const filamentCost = editForm.parts.reduce((sum, p) =>
      sum + p.filaments.reduce((s, f) => s + (parseFloat(f.totalCost) || 0), 0), 0
    )

    const printHours = ((parseInt(editForm.printHours) || 0) * 60 + (parseInt(editForm.printMinutes) || 0)) / 60
    const allPrinters = detail.farm?.printers || printers
    const selectedPrinter = allPrinters.find((p) => p.id === editForm.printerId)
    const watts = selectedPrinter?.powerConsumption ?? allPrinters[0]?.powerConsumption ?? 200
    const electricityRate = detail.farm?.electricityRate ?? 0.12
    const printCost = (electricityRate * watts / 1000) * printHours

    const prepCost = ((parseFloat(editForm.prepCostPerHour) || 0) / 60) * (parseFloat(editForm.prepTimeMinutes) || 0)
    const postCost = ((parseFloat(editForm.postCostPerHour) || 0) / 60) * (parseFloat(editForm.postTimeMinutes) || 0)
    const laborCost = prepCost + postCost

    const suppliesCost = editForm.supplies.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0)

    return {
      filament: filamentCost,
      print: printCost,
      labor: laborCost,
      supplies: suppliesCost,
      total: filamentCost + printCost + laborCost + suppliesCost,
    }
  }, [editForm, detail, printers])

  const selectClasses = "flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // ─── EDIT MODEL VIEW ──────────────────────────────
  if (detail && editForm) {
    const costs = computedCosts()
    const farmFilaments = detail.farm?.filaments || filaments
    const farmPrinters = detail.farm?.printers || printers
    const farmPlatforms = detail.farm?.salesPlatforms || []
    const farmShipping = detail.farm?.shippingProfiles || []

    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setDetail(null); setEditForm(null) }} className="rounded p-1.5 text-muted hover:bg-surface-raised hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Edit Model</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setDetail(null); setEditForm(null) }}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>

        {/* MODEL INFORMATION */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Model Information</h2>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {/* Image upload area */}
              <div className="shrink-0">
                <div className="flex h-40 w-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface-raised cursor-pointer hover:border-primary transition-colors">
                  {detail.thumbnailUrl || detail.imagePath ? (
                    <img
                      src={detail.imagePath ? `/api/uploads/images/${detail.imagePath}` : detail.thumbnailUrl!}
                      alt={detail.name}
                      className="h-full w-full rounded-lg object-cover"
                    />
                  ) : (
                    <>
                      <ImageIcon className="h-10 w-10 text-muted mb-1" />
                      <span className="text-xs text-muted">Upload Image</span>
                    </>
                  )}
                </div>
              </div>

              {/* Form fields */}
              <div className="flex-1 space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      label="Model Name *"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="w-64">
                    <label className="block text-sm font-medium text-foreground mb-1.5">SKUs</label>
                    <p className="text-xs text-muted mb-1">{editForm.skus.length === 0 ? 'No SKUs mapped yet' : `${editForm.skus.length} SKU(s)`}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add SKU..."
                        className="flex h-8 w-full rounded-lg border border-border bg-white px-2 text-xs shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const val = (e.target as HTMLInputElement).value.trim()
                            if (val) {
                              setEditForm({ ...editForm, skus: [...editForm.skus, { sku: val }] });
                              (e.target as HTMLInputElement).value = ''
                            }
                          }
                        }}
                      />
                      <Button size="sm" variant="outline" onClick={() => {
                        const input = document.querySelector('input[placeholder="Add SKU..."]') as HTMLInputElement
                        if (input?.value.trim()) {
                          setEditForm({ ...editForm, skus: [...editForm.skus, { sku: input.value.trim() }] })
                          input.value = ''
                        }
                      }}>Add</Button>
                    </div>
                    {editForm.skus.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {editForm.skus.map((s, i) => (
                          <Badge key={i} variant="default">
                            {s.sku}
                            <button className="ml-1 text-xs" onClick={() => setEditForm({ ...editForm, skus: editForm.skus.filter((_, idx) => idx !== i) })}>&times;</button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Input
                      label="Category *"
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    />
                    <p className="text-xs text-muted mt-0.5">Select existing or type new category</p>
                  </div>
                  <div>
                    <Input
                      label="Build Plate Qty"
                      type="number"
                      value={String(editForm.buildPlateQty)}
                      onChange={(e) => setEditForm({ ...editForm, buildPlateQty: parseInt(e.target.value) || 1 })}
                    />
                    <p className="text-xs text-muted mt-0.5">1 = already per unit</p>
                  </div>
                  <div>
                    <Input
                      label="Print Hours"
                      type="number"
                      value={editForm.printHours}
                      onChange={(e) => setEditForm({ ...editForm, printHours: e.target.value })}
                    />
                  </div>
                  <div>
                    <Input
                      label="Print Minutes"
                      type="number"
                      value={editForm.printMinutes}
                      onChange={(e) => setEditForm({ ...editForm, printMinutes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Designer"
                    value={editForm.designer}
                    onChange={(e) => setEditForm({ ...editForm, designer: e.target.value })}
                  />
                  <div>
                    <Input
                      label="Marketplace"
                      value={editForm.marketplaceName}
                      onChange={(e) => setEditForm({ ...editForm, marketplaceName: e.target.value })}
                    />
                    <p className="text-xs text-muted mt-0.5">e.g., 3D Print Force</p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.hasVariations}
                      onChange={(e) => setEditForm({ ...editForm, hasVariations: e.target.checked })}
                      className="rounded border-border text-primary focus:ring-ring/20"
                    />
                    Has Variations
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.hasPersonalization}
                      onChange={(e) => setEditForm({ ...editForm, hasPersonalization: e.target.checked })}
                      className="rounded border-border text-primary focus:ring-ring/20"
                    />
                    Has Personalization
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ATTACHED PRINT FILE */}
        {detail.originalFileName && (
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm">
                  Attached print file: <span className="font-medium text-primary">{detail.originalFileName}</span>
                  {detail.slicer && <span className="text-muted"> ({detail.slicer})</span>}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PRINTER MODEL FOR COSTING */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Printer Model for Costing</h2>
            <p className="text-xs text-muted mt-1">Select which printer model to use for cost calculations. Changing this will update electricity and maintenance costs.</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-72">
                <label className="block text-sm font-medium text-foreground mb-1.5">Printer Model *</label>
                <select
                  className={selectClasses}
                  value={editForm.printerId}
                  onChange={(e) => setEditForm({ ...editForm, printerId: e.target.value })}
                >
                  <option value="">Auto (first printer or 200W default)</option>
                  {farmPrinters.map((p) => (
                    <option key={p.id} value={p.id}>{p.brand} {p.model}</option>
                  ))}
                </select>
              </div>
              {editForm.printerId && (
                <span className="text-xs text-muted mt-6">
                  Pricing based on: {farmPrinters.find((p) => p.id === editForm.printerId)?.brand} {farmPrinters.find((p) => p.id === editForm.printerId)?.model}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PARTS & FILAMENTS */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Parts & Filaments</h2>
              <span className="text-sm font-semibold text-primary">Total: ${costs.filament.toFixed(2)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editForm.parts.map((part, pIdx) => (
              <div key={pIdx} className="rounded-lg border border-border">
                {/* Part header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-raised transition-colors"
                  onClick={() => {
                    const s = new Set(expandedParts)
                    s.has(pIdx) ? s.delete(pIdx) : s.add(pIdx)
                    setExpandedParts(s)
                  }}
                >
                  {expandedParts.has(pIdx) ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                  <input
                    className="text-sm font-medium bg-transparent border border-transparent hover:border-border rounded px-2 py-1 focus:border-primary focus:outline-none"
                    value={part.name}
                    onChange={(e) => {
                      const newParts = [...editForm.parts]
                      newParts[pIdx] = { ...newParts[pIdx], name: e.target.value }
                      setEditForm({ ...editForm, parts: newParts })
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs text-muted">({part.filaments.length} filament{part.filaments.length !== 1 ? 's' : ''})</span>
                  <span className="ml-auto text-sm font-medium">${part.filaments.reduce((s, f) => s + (parseFloat(f.totalCost) || 0), 0).toFixed(2)}</span>
                </div>

                {/* Filament rows */}
                {expandedParts.has(pIdx) && (
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    {part.filaments.map((fil, fIdx) => (
                      <div key={fIdx} className="grid grid-cols-[1fr_2fr_80px_100px_40px] gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Name</label>
                          <input
                            className="flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                            value={fil.name}
                            onChange={(e) => {
                              const newParts = [...editForm.parts]
                              newParts[pIdx].filaments[fIdx] = { ...fil, name: e.target.value }
                              setEditForm({ ...editForm, parts: newParts })
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Filament</label>
                          <select
                            className={selectClasses}
                            value={fil.filamentId}
                            onChange={(e) => recalcFilamentCost(pIdx, fIdx, 'filamentId', e.target.value)}
                          >
                            <option value="">Select filament</option>
                            {farmFilaments.map((f) => (
                              <option key={f.id} value={f.id}>{f.brand} - {f.material} {f.variant}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Grams</label>
                          <input
                            type="number"
                            step="0.01"
                            className="flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                            value={fil.grams}
                            onChange={(e) => recalcFilamentCost(pIdx, fIdx, 'grams', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted mb-1">Total</label>
                          <div className="flex items-center h-9 rounded-lg border border-border bg-white px-3 text-sm shadow-xs">
                            <span className="text-muted mr-1">$</span>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full bg-transparent focus:outline-none"
                              value={fil.totalCost}
                              onChange={(e) => {
                                const newParts = [...editForm.parts]
                                newParts[pIdx].filaments[fIdx] = { ...fil, totalCost: e.target.value }
                                setEditForm({ ...editForm, parts: newParts })
                              }}
                            />
                          </div>
                        </div>
                        <button
                          className="h-9 flex items-center justify-center rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                          onClick={() => {
                            const newParts = [...editForm.parts]
                            newParts[pIdx] = { ...newParts[pIdx], filaments: newParts[pIdx].filaments.filter((_, i) => i !== fIdx) }
                            setEditForm({ ...editForm, parts: newParts })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                      onClick={() => {
                        const newParts = [...editForm.parts]
                        newParts[pIdx] = {
                          ...newParts[pIdx],
                          filaments: [...newParts[pIdx].filaments, { name: '', filamentId: '', grams: '0', totalCost: '0' }],
                        }
                        setEditForm({ ...editForm, parts: newParts })
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Filament
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button
              className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
              onClick={() => setEditForm({
                ...editForm,
                parts: [...editForm.parts, { name: `Plate ${editForm.parts.length + 1}`, filaments: [] }],
              })}
            >
              <Plus className="h-3.5 w-3.5" /> Add Model Part
            </button>
          </CardContent>
        </Card>

        {/* LABOR COSTS */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Labor Costs</h2>
                <p className="text-xs text-muted mt-1">Farm Settings supplies the default hourly rate, and you can override it per model here.</p>
              </div>
              <span className="text-sm font-semibold text-primary">Total: ${costs.labor.toFixed(2)}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Print Preparation */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Print Preparation</h3>
                <Input
                  label="Time (minutes)"
                  type="number"
                  value={editForm.prepTimeMinutes}
                  onChange={(e) => setEditForm({ ...editForm, prepTimeMinutes: e.target.value })}
                />
                <Input
                  label="Cost Per Hour"
                  type="number"
                  prefix="$"
                  value={editForm.prepCostPerHour}
                  onChange={(e) => setEditForm({ ...editForm, prepCostPerHour: e.target.value })}
                />
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Total Cost</label>
                  <div className="text-sm font-medium text-foreground">
                    $ {(((parseFloat(editForm.prepCostPerHour) || 0) / 60) * (parseFloat(editForm.prepTimeMinutes) || 0)).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Post Processing */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Post Processing</h3>
                <Input
                  label="Time (minutes)"
                  type="number"
                  value={editForm.postTimeMinutes}
                  onChange={(e) => setEditForm({ ...editForm, postTimeMinutes: e.target.value })}
                />
                <Input
                  label="Cost Per Hour"
                  type="number"
                  prefix="$"
                  value={editForm.postCostPerHour}
                  onChange={(e) => setEditForm({ ...editForm, postCostPerHour: e.target.value })}
                />
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Total Cost</label>
                  <div className="text-sm font-medium text-foreground">
                    $ {(((parseFloat(editForm.postCostPerHour) || 0) / 60) * (parseFloat(editForm.postTimeMinutes) || 0)).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OTHER MODEL SUPPLIES */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Other Model Supplies</h2>
              <span className="text-sm font-semibold text-primary">Total: ${costs.supplies.toFixed(2)}</span>
            </div>
          </CardHeader>
          <CardContent>
            {editForm.supplies.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-sm text-muted">No additional supplies added. Click "Add Supply" to include items like packaging, ornament strings, screws, magnets, etc.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {editForm.supplies.map((s, i) => (
                  <div key={i} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Input
                        label="Name"
                        value={s.name}
                        onChange={(e) => {
                          const newSupplies = [...editForm.supplies]
                          newSupplies[i] = { ...s, name: e.target.value }
                          setEditForm({ ...editForm, supplies: newSupplies })
                        }}
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        label="Cost"
                        type="number"
                        prefix="$"
                        step="0.01"
                        value={s.cost}
                        onChange={(e) => {
                          const newSupplies = [...editForm.supplies]
                          newSupplies[i] = { ...s, cost: e.target.value }
                          setEditForm({ ...editForm, supplies: newSupplies })
                        }}
                      />
                    </div>
                    <button
                      className="h-9 flex items-center justify-center rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => setEditForm({ ...editForm, supplies: editForm.supplies.filter((_, idx) => idx !== i) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              className="mt-3 text-sm text-primary font-medium hover:underline flex items-center gap-1"
              onClick={() => setEditForm({ ...editForm, supplies: [...editForm.supplies, { name: '', cost: '0' }] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add Supply
            </button>
          </CardContent>
        </Card>

        {/* SALES PLATFORMS */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Sales Platforms</h2>
            <p className="text-xs text-muted mt-1">Select which platforms this model will be sold on. You'll configure pricing later.</p>
          </CardHeader>
          <CardContent>
            {farmPlatforms.length === 0 ? (
              <p className="text-sm text-muted">No platforms configured. Add marketplaces in Settings first.</p>
            ) : (
              <div className="space-y-3">
                {editForm.platformAssignments.map((assignment, aIdx) => {
                  const platform = farmPlatforms.find((p) => p.id === assignment.platformId)
                  if (!platform) return null
                  return (
                    <div key={aIdx} className="flex items-center gap-4 rounded-lg border border-border p-3">
                      <label className="flex items-center gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={assignment.enabled}
                          onChange={(e) => {
                            const newAssignments = [...editForm.platformAssignments]
                            newAssignments[aIdx] = { ...assignment, enabled: e.target.checked }
                            setEditForm({ ...editForm, platformAssignments: newAssignments })
                          }}
                          className="rounded border-border text-primary focus:ring-ring/20"
                        />
                        <span className="text-sm font-medium">{platform.shopName || platform.type}</span>
                        <span className={`h-2 w-2 rounded-full ${platform.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </label>
                      {assignment.enabled && farmShipping.length > 0 && (
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-muted mb-1">Shipping Profile</label>
                          <select
                            className={selectClasses}
                            value={assignment.shippingProfileId}
                            onChange={(e) => {
                              const newAssignments = [...editForm.platformAssignments]
                              newAssignments[aIdx] = { ...assignment, shippingProfileId: e.target.value }
                              setEditForm({ ...editForm, platformAssignments: newAssignments })
                            }}
                          >
                            <option value="">Select the shipping method for this platform</option>
                            {farmShipping.map((sp) => (
                              <option key={sp.id} value={sp.id}>{sp.name} - ${sp.customerPays.toFixed(2)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* COST SUMMARY */}
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">Cost Summary</h2>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted uppercase">Filament Cost</p>
              <p className="text-lg font-bold text-foreground">${costs.filament.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase">Print Cost</p>
              <p className="text-lg font-bold text-foreground">${costs.print.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase">Labor Cost</p>
              <p className="text-lg font-bold text-foreground">${costs.labor.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase">Supplies Cost</p>
              <p className="text-lg font-bold text-foreground">${costs.supplies.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted uppercase">Total COGS</p>
              <p className="text-lg font-bold text-primary">${costs.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex items-center justify-between pb-8">
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDelete(detail.id)}>
            <Trash2 className="h-4 w-4" /> Delete Model
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setDetail(null); setEditForm(null) }}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── MODEL LIST VIEW ──────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">3D Models</h1>
          <p className="text-sm text-muted mt-1">{models.length} model{models.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true) }}>
          <Plus className="h-4 w-4" /> Add Model
        </Button>
      </div>

      {models.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Box className="h-12 w-12" />}
              title="No models yet"
              description="Upload a .3mf file or manually enter model details to see pricing calculations"
              action={<Button onClick={() => { resetForm(); setShowAdd(true) }}><Plus className="h-4 w-4" /> Add Model</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <tr>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Print Time</TableHead>
                <TableHead>Filament</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="pr-0">
                    {model.thumbnailUrl ? (
                      <img src={model.thumbnailUrl} alt={model.name} className="h-10 w-10 rounded-md object-cover border border-border" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-raised border border-border-light">
                        <ImageIcon className="h-5 w-5 text-muted" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{model.name}</p>
                      <p className="text-xs text-muted">{formatTime(model.printTimeMinutes)} &middot; {model.filamentUsageGrams}g</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {model.slicer ? (
                      <Badge variant="info">{model.slicer}</Badge>
                    ) : model.originalFileName ? (
                      <Badge variant="default">Upload</Badge>
                    ) : (
                      <span className="text-muted text-xs">Manual</span>
                    )}
                  </TableCell>
                  <TableCell>{formatTime(model.printTimeMinutes)}</TableCell>
                  <TableCell>{model.filamentUsageGrams}g</TableCell>
                  <TableCell>
                    {model.filament ? (
                      <Badge variant="info">{model.filament.material}</Badge>
                    ) : (
                      <span className="text-muted">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditModel(model.id)} className="rounded p-1.5 text-muted hover:bg-surface-raised hover:text-foreground transition-colors" title="Edit model">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(model.id)} className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
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
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm() }} title="Add Model">
        <div className="flex rounded-lg border border-border p-1 mb-4">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === 'upload' ? 'bg-primary text-white' : 'text-muted hover:text-foreground'}`}
            onClick={() => setMode('upload')}
          >
            <Upload className="h-4 w-4" /> Upload File
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-primary text-white' : 'text-muted hover:text-foreground'}`}
            onClick={() => setMode('manual')}
          >
            <FileUp className="h-4 w-4" /> Manual Entry
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {mode === 'upload' && (
            <div className="space-y-3">
              <div
                className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                  parseResult ? 'border-green-300 bg-green-50' : dragOver ? 'border-primary bg-orange-50/50' : 'border-border hover:border-primary hover:bg-orange-50/30'
                } ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
                onDrop={handleDrop}
              >
                <input ref={fileInputRef} type="file" accept=".3mf,.stl,.gcode" className="hidden" onChange={handleFileUpload} />
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm font-medium text-foreground">Parsing file...</p>
                  </>
                ) : parseResult ? (
                  <div className="flex items-center gap-4 w-full">
                    {parseResult.thumbnailUrl ? (
                      <img src={parseResult.thumbnailUrl} alt="Preview" className="h-20 w-20 rounded-lg object-cover border border-green-200 shrink-0" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-green-100 border border-green-200 shrink-0">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{parseResult.fileName}</p>
                      {parseResult.slicer && (
                        <p className="text-xs text-muted mt-1">
                          Detected: <span className="text-blue-600 font-medium">{parseResult.slicer}</span>
                          {parseResult.printTimeMinutes != null && parseResult.filamentUsageGrams != null && (
                            <> — {formatTime(parseResult.printTimeMinutes)}, {parseResult.filamentUsageGrams}g</>
                          )}
                        </p>
                      )}
                      {parseResult.parseError && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{parseResult.parseError}</p>
                      )}
                      <p className="text-xs text-muted mt-1">Click to replace</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted mb-2" />
                    <p className="text-sm font-medium text-foreground">Drop a .3mf file or click to browse</p>
                    <p className="text-xs text-muted mt-1">Print time & filament usage will be extracted automatically</p>
                  </>
                )}
              </div>
              {parseResult && parseResult.printTimeMinutes != null && parseResult.filamentUsageGrams != null && (
                <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>Print time and filament usage auto-filled from {parseResult.slicer || 'file'} metadata. You can adjust below.</span>
                </div>
              )}
            </div>
          )}

          <Input label="Model Name" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
          <Input label="Print Time (minutes)" type="number" step="1" suffix="min" value={addForm.printTimeMinutes} onChange={(e) => setAddForm({ ...addForm, printTimeMinutes: e.target.value })} required />
          <Input label="Filament Usage" type="number" step="0.1" suffix="grams" value={addForm.filamentUsageGrams} onChange={(e) => setAddForm({ ...addForm, filamentUsageGrams: e.target.value })} required />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Filament</label>
            <select className={selectClasses} value={addForm.filamentId} onChange={(e) => setAddForm({ ...addForm, filamentId: e.target.value })}>
              <option value="">None (use default cost)</option>
              {filaments.map((f) => (<option key={f.id} value={f.id}>{f.brand} {f.material} - {f.variant}</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Printer</label>
            <select className={selectClasses} value={addForm.printerId} onChange={(e) => setAddForm({ ...addForm, printerId: e.target.value })}>
              <option value="">Auto (first printer or 200W default)</option>
              {printers.map((p) => (<option key={p.id} value={p.id}>{p.brand} {p.model} ({p.powerConsumption}W)</option>))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowAdd(false); resetForm() }}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving || (mode === 'upload' && !parseResult)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'upload' ? 'Upload & Add' : 'Add Model'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
