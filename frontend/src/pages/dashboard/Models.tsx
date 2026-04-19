import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import { Card, CardContent } from '../../components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Plus, Trash2, Eye, Loader2, Box, Upload, FileUp, CheckCircle, AlertCircle } from 'lucide-react'

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
  originalFileName: string | null
  slicer: string | null
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

interface ParseResult {
  fileName: string
  name: string
  printTimeMinutes: number | null
  filamentUsageGrams: number | null
  filamentType: string | null
  slicer: string | null
  storedFileName: string
  parseError?: string
}

export default function Models() {
  const [models, setModels] = useState<Model3D[]>([])
  const [filaments, setFilaments] = useState<Filament[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<ModelDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'manual' | 'upload'>('upload')
  const [uploading, setUploading] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  function resetForm() {
    setForm({ name: '', printTimeMinutes: '', filamentUsageGrams: '', filamentId: '' })
    setParseResult(null)
    setMode('upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

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

      // Auto-fill form with extracted data
      setForm((prev) => ({
        ...prev,
        name: result.name || prev.name,
        printTimeMinutes: result.printTimeMinutes != null ? String(Math.round(result.printTimeMinutes)) : prev.printTimeMinutes,
        filamentUsageGrams: result.filamentUsageGrams != null ? String(Math.round(result.filamentUsageGrams * 100) / 100) : prev.filamentUsageGrams,
      }))

      // Try to auto-match filament by type
      if (result.filamentType && filaments.length > 0) {
        const match = filaments.find((f) =>
          f.material.toLowerCase() === result.filamentType!.toLowerCase()
        )
        if (match) {
          setForm((prev) => ({ ...prev, filamentId: match.id }))
        }
      }
    } catch {
      // error
    } finally {
      setUploading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      let model: Model3D

      if (mode === 'upload' && parseResult) {
        // Upload mode — use stored file + form overrides
        const formData = new FormData()
        // Re-upload the file (stored filename reference)
        const fileInput = fileInputRef.current
        if (fileInput?.files?.[0]) {
          formData.append('file', fileInput.files[0])
        }
        formData.append('name', form.name)
        formData.append('printTimeMinutes', form.printTimeMinutes)
        formData.append('filamentUsageGrams', form.filamentUsageGrams)
        if (form.filamentId) formData.append('filamentId', form.filamentId)

        const token = localStorage.getItem('token')
        const res = await fetch('/api/models/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })

        if (!res.ok) throw new Error('Upload failed')
        model = await res.json()
      } else {
        // Manual mode
        model = await api<Model3D>('/models', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            printTimeMinutes: parseFloat(form.printTimeMinutes),
            filamentUsageGrams: parseFloat(form.filamentUsageGrams),
            filamentId: form.filamentId || null,
          }),
        })
      }

      setModels([model, ...models])
      setShowAdd(false)
      resetForm()
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
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
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
      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm() }} title="Add Model">
        {/* Mode Toggle */}
        <div className="flex rounded-lg border border-gray-200 p-1 mb-4">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setMode('upload')}
          >
            <Upload className="h-4 w-4" /> Upload File
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'manual'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setMode('manual')}
          >
            <FileUp className="h-4 w-4" /> Manual Entry
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* File Upload Area */}
          {mode === 'upload' && (
            <div className="space-y-3">
              <div
                className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                  parseResult
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-primary hover:bg-orange-50/30'
                } ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".3mf,.stl,.gcode"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm font-medium text-gray-700">Parsing file...</p>
                  </>
                ) : parseResult ? (
                  <>
                    <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm font-medium text-gray-900">{parseResult.fileName}</p>
                    {parseResult.slicer && (
                      <p className="text-xs text-gray-500 mt-1">
                        Detected: {parseResult.slicer}
                        {parseResult.printTimeMinutes != null && parseResult.filamentUsageGrams != null && (
                          <> — {formatTime(parseResult.printTimeMinutes)}, {parseResult.filamentUsageGrams}g</>
                        )}
                      </p>
                    )}
                    {parseResult.parseError && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {parseResult.parseError}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">Click to replace</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">Drop a .3mf file or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">Print time & filament usage will be extracted automatically</p>
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
            <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowAdd(false); resetForm() }}>Cancel</Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={saving || (mode === 'upload' && !parseResult)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'upload' ? 'Upload & Add' : 'Add Model'}
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
              <p className="text-sm text-muted">
                {formatTime(detail.printTimeMinutes)} &middot; {detail.filamentUsageGrams}g
                {detail.slicer && <> &middot; <span className="text-blue-600">{detail.slicer}</span></>}
              </p>
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
