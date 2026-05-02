import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../lib/api'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  Plus, Trash2, Loader2, Box, Upload, FileUp, CheckCircle, AlertCircle,
  Image as ImageIcon, ArrowLeft, ChevronDown, ChevronUp, Info,
  Search, Clock, Edit,
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
  purchasePrice: number
  expectedLifetimeHours: number
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
  printTimeMinutes: number
  buildPlateQty: number
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

interface PricingSummary {
  totalCost: number
  avgSellingPrice: number
  avgProfit: number
  avgProfitPerHour: number
  avgProfitMargin: number
  shippingCost: number
  machineryCost: number
  maintenanceCost: number
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
  skus: ModelSku[]
  pricingSummary: PricingSummary
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

interface ParsedFilamentDetail {
  id: number
  type: string
  color: string
  usedGrams: number
  usedMeters: number
}

interface ParsedPlateInfo {
  index: number
  printTimeMinutes: number
  filamentUsageGrams: number
  filaments: ParsedFilamentDetail[]
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
  plates: ParsedPlateInfo[]
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
    printTimeHours: string
    printTimeMins: string
    buildPlateQty: string
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
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // List view state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [mode, setMode] = useState<'manual' | 'upload'>('upload')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '',
    printTimeHours: '',
    printTimeMins: '',
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
    setAddForm({ name: '', printTimeHours: '', printTimeMins: '', filamentUsageGrams: '', filamentId: '', printerId: '' })
    setParseResult(null)
    setUploadError(null)
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
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/models/upload/parse', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 422 && errData.isUnsliced) {
          throw new Error('This file has not been sliced yet. Open it in BambuStudio / PrusaSlicer / OrcaSlicer, slice it, then re-export as .3mf.')
        }
        throw new Error(errData.error || `Upload failed (${res.status})`)
      }
      const result: ParseResult = await res.json()
      setParseResult(result)
      // Strip .gcode suffix from name if present (e.g. "rose(4).gcode" → "rose(4)")
      const cleanName = (result.name || '').replace(/\.gcode$/i, '')
      setAddForm((prev) => ({
        ...prev,
        name: cleanName || prev.name,
        printTimeHours: result.printTimeMinutes != null ? String(Math.floor(result.printTimeMinutes / 60)) : prev.printTimeHours,
        printTimeMins: result.printTimeMinutes != null ? String(Math.round(result.printTimeMinutes % 60)) : prev.printTimeMins,
        filamentUsageGrams: result.filamentUsageGrams != null ? String(Math.round(result.filamentUsageGrams * 100) / 100) : prev.filamentUsageGrams,
      }))
      if (result.filamentType && filaments.length > 0) {
        const match = filaments.find((f) => f.material.toLowerCase() === result.filamentType!.toLowerCase())
        if (match) setAddForm((prev) => ({ ...prev, filamentId: match.id }))
      }
      if (result.parseError) {
        setUploadError(`File uploaded but metadata could not be extracted: ${result.parseError}. Please fill in the details manually.`)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (mode === 'upload' && parseResult) {
        const formData = new FormData()
        const fileInput = fileInputRef.current
        if (fileInput?.files?.[0]) formData.append('file', fileInput.files[0])
        formData.append('name', addForm.name)
        formData.append('printTimeMinutes', String((parseFloat(addForm.printTimeHours) || 0) * 60 + (parseFloat(addForm.printTimeMins) || 0)))
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
        await res.json()
      } else {
        await api<Model3D>('/models', {
          method: 'POST',
          body: JSON.stringify({
            name: addForm.name,
            printTimeMinutes: (parseFloat(addForm.printTimeHours) || 0) * 60 + (parseFloat(addForm.printTimeMins) || 0),
            filamentUsageGrams: parseFloat(addForm.filamentUsageGrams),
            filamentId: addForm.filamentId || null,
            printerId: addForm.printerId || null,
          }),
        })
      }
      // Refetch full list to get pricingSummary
      const refreshed = await api<Model3D[]>('/models')
      setModels(refreshed)
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
      skus: (d.skus || []).length > 0 ? d.skus.map((s) => ({ sku: s.sku })) : [],
      parts: (d.parts || []).length > 0
        ? d.parts.map((p) => ({
            name: p.name,
            printTimeHours: String(Math.floor((p.printTimeMinutes ?? 0) / 60)),
            printTimeMins: String(Math.round((p.printTimeMinutes ?? 0) % 60)),
            buildPlateQty: String(p.buildPlateQty ?? 1),
            filaments: (p.filaments || []).map((f) => ({
              name: f.name,
              filamentId: f.filamentId || '',
              grams: String(f.grams),
              totalCost: String(f.totalCost),
            })),
          }))
        : [{
            name: 'Plate 1',
            printTimeHours: String(Math.floor((d.printTimeMinutes ?? 0) / 60)),
            printTimeMins: String(Math.round((d.printTimeMinutes ?? 0) % 60)),
            buildPlateQty: String(d.buildPlateQty ?? 1),
            filaments: d.filamentUsageGrams > 0
              ? [{
                  name: d.filament ? `${d.filament.material}` : 'Default',
                  filamentId: d.filamentId || (farmFilaments.length > 0 ? farmFilaments[0].id : ''),
                  grams: String(d.filamentUsageGrams),
                  totalCost: String(d.filament ? (d.filament.costPerSpool / d.filament.spoolWeight * d.filamentUsageGrams).toFixed(2) : '0'),
                }]
              : [],
          }],
      supplies: (d.supplies || []).map((s) => ({ name: s.name, cost: String(s.cost) })),
      platformAssignments: d.farm?.salesPlatforms.map((sp) => {
        const existing = (d.platformAssignments || []).find((a) => a.platformId === sp.id)
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
      const printTimeMinutes = editForm.parts.length > 0
        ? editForm.parts.reduce((sum, p) => sum + (parseFloat(p.printTimeHours) || 0) * 60 + (parseFloat(p.printTimeMins) || 0), 0)
        : (parseInt(editForm.printHours) || 0) * 60 + (parseInt(editForm.printMinutes) || 0)
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
          prepTimeMinutes: parseFloat(editForm.prepTimeMinutes) || 0,
          prepCostPerHour: parseFloat(editForm.prepCostPerHour) || null,
          postTimeMinutes: parseFloat(editForm.postTimeMinutes) || 0,
          postCostPerHour: parseFloat(editForm.postCostPerHour) || null,
          skus: editForm.skus.filter((s) => s.sku.trim()),
          parts: editForm.parts.map((p) => ({
            name: p.name,
            printTimeMinutes: (parseFloat(p.printTimeHours) || 0) * 60 + (parseFloat(p.printTimeMins) || 0),
            buildPlateQty: parseInt(p.buildPlateQty) || 1,
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

      // Reload list and close detail
      const updatedModels = await api<Model3D[]>('/models')
      setModels(updatedModels)
      setDetail(null)
      setEditForm(null)
      setToast({ type: 'success', message: 'Model saved successfully' })
      setTimeout(() => setToast(null), 3000)
    } catch {
      setToast({ type: 'error', message: 'Failed to save model' })
      setTimeout(() => setToast(null), 4000)
    } finally { setSaving(false) }
  }

  function formatTime(minutes: number) {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  // Computed costs from edit form (with breakdown details)
  const computedCosts = useCallback(() => {
    if (!editForm || !detail) return { filament: 0, print: 0, labor: 0, machinery: 0, maintenance: 0, supplies: 0, total: 0, qty: 1, breakdown: null as any }

    const allPrinters = detail.farm?.printers || printers
    const selectedPrinter = allPrinters.find((p) => p.id === editForm.printerId) ?? allPrinters[0] ?? null
    const watts = selectedPrinter?.powerConsumption ?? 200
    const electricityRate = detail.farm?.electricityRate ?? 0.12
    const purchasePrice = selectedPrinter?.purchasePrice ?? 0
    const lifetimeHours = selectedPrinter?.expectedLifetimeHours ?? 5000
    const maintenanceRate = (detail.farm as any)?.maintenanceRate ?? 0.15

    // Per-plate: sum per-unit costs across all plates
    let filamentCost = 0
    let printCost = 0
    let machineryCost = 0
    let maintenanceCost = 0

    for (const part of editForm.parts) {
      const plateQty = Math.max(1, parseInt(part.buildPlateQty) || 1)
      const plateHours = ((parseFloat(part.printTimeHours) || 0) * 60 + (parseFloat(part.printTimeMins) || 0)) / 60
      printCost += ((electricityRate * watts / 1000) * plateHours) / plateQty
      machineryCost += lifetimeHours > 0 ? ((purchasePrice / lifetimeHours) * plateHours) / plateQty : 0
      maintenanceCost += (maintenanceRate * plateHours) / plateQty
      filamentCost += part.filaments.reduce((s, f) => s + (parseFloat(f.totalCost) || 0), 0) / plateQty
    }

    const prepRate = parseFloat(editForm.prepCostPerHour) || 0
    const postRate = parseFloat(editForm.postCostPerHour) || 0
    const prepMins = parseFloat(editForm.prepTimeMinutes) || 0
    const postMins = parseFloat(editForm.postTimeMinutes) || 0
    const prepCost = (prepRate / 60) * prepMins
    const postCost = (postRate / 60) * postMins
    const laborCost = prepCost + postCost
    const suppliesCost = editForm.supplies.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0)

    // For display: total plate print hours (first plate or sum)
    const totalPrintHours = editForm.parts.reduce((sum, p) => sum + (parseFloat(p.printTimeHours) || 0) + (parseFloat(p.printTimeMins) || 0) / 60, 0)

    return {
      filament: filamentCost,
      print: printCost,
      labor: laborCost,
      machinery: machineryCost,
      maintenance: maintenanceCost,
      supplies: suppliesCost,
      total: filamentCost + printCost + laborCost + machineryCost + maintenanceCost + suppliesCost,
      qty: 1,
      breakdown: {
        printHours: totalPrintHours,
        watts,
        electricityRate,
        prepRate,
        postRate,
        prepMins,
        postMins,
        prepCost,
        postCost,
        purchasePrice,
        lifetimeHours,
        maintenanceRate,
      },
    }
  }, [editForm, detail, printers])

  // ─── Filtered, sorted, paginated models ────────────
  const filteredModels = models.filter((m) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const skuMatch = m.skus?.some((s) => s.sku.toLowerCase().includes(q))
    return m.name.toLowerCase().includes(q) || skuMatch
  })

  const sortedModels = [...filteredModels].sort((a, b) => {
    switch (sortBy) {
      case 'name-asc': return a.name.localeCompare(b.name)
      case 'name-desc': return b.name.localeCompare(a.name)
      case 'cost-asc': return (a.pricingSummary?.totalCost ?? 0) - (b.pricingSummary?.totalCost ?? 0)
      case 'cost-desc': return (b.pricingSummary?.totalCost ?? 0) - (a.pricingSummary?.totalCost ?? 0)
      case 'date-desc': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'date-asc': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      default: return 0
    }
  })

  const totalPages = Math.max(1, Math.ceil(sortedModels.length / pageSize))
  const paginatedModels = sortedModels.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Stats
  const stats = {
    totalModels: models.length,
    avgListPrice: models.length > 0 ? models.reduce((s, m) => s + (m.pricingSummary?.avgSellingPrice ?? 0), 0) / models.length : 0,
    avgProfit: models.length > 0 ? models.reduce((s, m) => s + (m.pricingSummary?.avgProfit ?? 0), 0) / models.length : 0,
    avgProfitPerHour: models.length > 0 ? models.reduce((s, m) => s + (m.pricingSummary?.avgProfitPerHour ?? 0), 0) / models.length : 0,
    avgGrossMargin: models.length > 0 ? models.reduce((s, m) => s + (m.pricingSummary?.avgProfitMargin ?? 0), 0) / models.length : 0,
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getPlatformBadge(type: string) {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      etsy: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'ETSY' },
      amazon: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'AMAZON' },
      shopify: { bg: 'bg-green-100', text: 'text-green-700', label: 'SHOPIFY' },
      ebay: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'EBAY' },
      tiktok: { bg: 'bg-pink-100', text: 'text-pink-700', label: 'TIKTOK' },
      custom: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'CUSTOM' },
    }
    return badges[type.toLowerCase()] || badges.custom
  }

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

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Input
                      label="Category *"
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    />
                    <p className="text-xs text-muted mt-0.5">Select existing or type new category</p>
                  </div>
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

        {/* PLATES & FILAMENTS */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wide">Plates & Filaments</h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted">
                  {editForm.parts.reduce((sum, p) => sum + p.filaments.reduce((s, f) => s + (parseFloat(f.grams) || 0), 0), 0).toFixed(1)}g total
                </span>
                <span className="text-sm font-semibold text-primary">Total: ${costs.filament.toFixed(2)}</span>
              </div>
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
                    {/* Per-plate print settings */}
                    <div className="grid grid-cols-3 gap-3 pb-2 border-b border-border-light">
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Print Time (minutes)</label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          className="flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                          value={part.printTimeMinutes}
                          onChange={(e) => {
                            const newParts = [...editForm.parts]
                            newParts[pIdx] = { ...newParts[pIdx], printTimeMinutes: e.target.value }
                            setEditForm({ ...editForm, parts: newParts })
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted mb-1">Items per Plate</label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          className="flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                          value={part.buildPlateQty}
                          onChange={(e) => {
                            const newParts = [...editForm.parts]
                            newParts[pIdx] = { ...newParts[pIdx], buildPlateQty: e.target.value }
                            setEditForm({ ...editForm, parts: newParts })
                          }}
                        />
                        <p className="text-xs text-muted mt-0.5">How many units fit on this plate</p>
                      </div>
                      <div className="flex items-end pb-0.5">
                        <span className="text-xs text-muted">
                          Cost/unit: <span className="font-medium text-foreground">
                            ${((part.filaments.reduce((s, f) => s + (parseFloat(f.totalCost) || 0), 0)) / Math.max(1, parseInt(part.buildPlateQty) || 1)).toFixed(2)}
                          </span> filament
                        </span>
                      </div>
                    </div>
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
                          <div className="flex items-center h-9 rounded-lg border border-border bg-surface-raised px-3 text-sm shadow-xs">
                            <span className="text-muted mr-1">$</span>
                            <span className="text-foreground">{fil.totalCost}</span>
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
                parts: [...editForm.parts, { name: `Plate ${editForm.parts.length + 1}`, printTimeHours: '0', printTimeMins: '0', buildPlateQty: '1', filaments: [] }],
              })}
            >
              <Plus className="h-3.5 w-3.5" /> Add Plate
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
            <p className="text-xs text-muted mt-1">Select which platforms this model will be sold on. Pricing is computed automatically based on costs, fees, and margin.</p>
          </CardHeader>
          <CardContent>
            {farmPlatforms.length === 0 ? (
              <p className="text-sm text-muted">No platforms configured. Add marketplaces in Settings first.</p>
            ) : (
              <div className="space-y-3">
                {editForm.platformAssignments.map((assignment, aIdx) => {
                  const platform = farmPlatforms.find((p) => p.id === assignment.platformId)
                  if (!platform) return null

                  // Compute per-platform pricing when enabled
                  let platformCalc: { sellingPrice: number; platformFees: number; profit: number; profitMargin: number; formula: string; shippingCost: number; shippingRevenue: number } | null = null
                  if (assignment.enabled) {
                    const fees = platform.feesConfig || {}
                    // Use pre-computed totals or fall back to granular fee fields
                    const totalPct = parseFloat(fees.percentage || '0') ||
                      ((parseFloat(fees.transactionPct || '0') + parseFloat(fees.processingPct || '0')))
                    const totalFlat = parseFloat(fees.flat || '0') ||
                      ((parseFloat(fees.processingFlat || '0') + parseFloat(fees.listingFee || '0')))
                    const pctFee = totalPct / 100
                    const targetMargin = (detail.farm as any)?.targetProfitMargin ?? 50
                    const marginFraction = targetMargin / 100
                    const shippingProfile = farmShipping.find((sp) => sp.id === assignment.shippingProfileId)
                    const shippingCost = shippingProfile?.postageCost ?? 0
                    const shippingRevenue = shippingProfile?.customerPays ?? 0

                    // Selling price covers COGS + platform fees + margin only.
                    // Shipping is collected separately by the platform.
                    const denominator = 1 - pctFee - marginFraction
                    let sellingPrice: number
                    if (denominator > 0) {
                      sellingPrice = (costs.total + totalFlat) / denominator
                    } else {
                      sellingPrice = costs.total * (1 + marginFraction) + totalFlat + costs.total * pctFee
                    }
                    if (sellingPrice < costs.total) sellingPrice = costs.total

                    const platformFees = sellingPrice * pctFee + totalFlat
                    const profit = sellingPrice - costs.total - platformFees

                    const formula = `($${costs.total.toFixed(2)} COGS + $${totalFlat.toFixed(2)} flat fee) / (1 - ${(pctFee * 100).toFixed(1)}% fee - ${targetMargin}% margin)`

                    platformCalc = {
                      sellingPrice: +sellingPrice.toFixed(2),
                      platformFees: +platformFees.toFixed(2),
                      profit: +profit.toFixed(2),
                      profitMargin: sellingPrice > 0 ? +(profit / sellingPrice * 100).toFixed(1) : 0,
                      formula,
                      shippingCost,
                      shippingRevenue,
                    }
                  }

                  return (
                    <div key={aIdx} className="rounded-lg border border-border overflow-hidden">
                      <div className="flex items-center gap-4 p-3">
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
                        {assignment.enabled && platformCalc && (
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-bold text-primary">${platformCalc.sellingPrice.toFixed(2)}</p>
                            <p className="text-xs text-muted">selling price</p>
                          </div>
                        )}
                      </div>
                      {/* Pricing breakdown when enabled */}
                      {assignment.enabled && platformCalc && (
                        <div className="border-t border-border bg-surface-raised px-4 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted">Selling Price</p>
                              <p className="font-semibold text-foreground">${platformCalc.sellingPrice.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted">Platform Fees</p>
                              <p className="font-semibold text-red-600">-${platformCalc.platformFees.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted">Profit</p>
                              <p className={`font-semibold ${platformCalc.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${platformCalc.profit.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted">Margin</p>
                              <p className={`font-semibold ${platformCalc.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{platformCalc.profitMargin}%</p>
                            </div>
                          </div>
                          {platformCalc.shippingCost > 0 && (
                            <p className="text-xs text-muted mt-1">
                              Shipping: customer pays ${platformCalc.shippingRevenue.toFixed(2)} / postage costs ${platformCalc.shippingCost.toFixed(2)} — collected separately from item price
                            </p>
                          )}
                          <p className="text-xs text-muted mt-1">{platformCalc.formula}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* COST SUMMARY WITH BREAKDOWN */}
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Cost Breakdown</h2>
            {costs.qty > 1 && (
              <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded-full">
                Per item — plate has {costs.qty} items
              </span>
            )}
          </div>
          <div className="space-y-3">
            {/* Filament */}
            <div className="flex items-start justify-between py-2 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Filament</p>
                <p className="text-xs text-muted mt-0.5">
                  {editForm.parts.flatMap(p => p.filaments).map((f, i) => {
                    const fil = filaments.find(fl => fl.id === f.filamentId)
                    const g = parseFloat(f.grams) || 0
                    const rate = fil ? (fil.costPerSpool / fil.spoolWeight) : 0
                    const itemG = costs.qty > 1 ? g / costs.qty : g
                    return <span key={i} className="block">{f.name || 'Unnamed'}: {itemG.toFixed(1)}g x ${rate.toFixed(4)}/g = ${(itemG * rate).toFixed(2)}{costs.qty > 1 ? ` (÷${costs.qty})` : ''}</span>
                  })}
                </p>
              </div>
              <p className="text-sm font-bold text-foreground">${costs.filament.toFixed(2)}</p>
            </div>

            {/* Electricity */}
            <div className="flex items-start justify-between py-2 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Electricity</p>
                <p className="text-xs text-muted mt-0.5">
                  ${costs.breakdown?.electricityRate.toFixed(2)}/kWh x {costs.breakdown?.watts}W / 1000 x {costs.breakdown?.printHours.toFixed(2)}h{costs.qty > 1 ? ` ÷ ${costs.qty}` : ''}
                </p>
              </div>
              <p className="text-sm font-bold text-foreground">${costs.print.toFixed(2)}</p>
            </div>

            {/* Labor */}
            <div className="flex items-start justify-between py-2 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Labor</p>
                <p className="text-xs text-muted mt-0.5">
                  Prep: ${costs.breakdown?.prepRate.toFixed(2)}/hr x {costs.breakdown?.prepMins.toFixed(0)}min = ${costs.breakdown?.prepCost.toFixed(2)}{costs.qty > 1 ? ` (÷${costs.qty})` : ''}
                  <br />
                  Post: ${costs.breakdown?.postRate.toFixed(2)}/hr x {costs.breakdown?.postMins.toFixed(0)}min = ${costs.breakdown?.postCost.toFixed(2)}{costs.qty > 1 ? ` (÷${costs.qty})` : ''}
                </p>
              </div>
              <p className="text-sm font-bold text-foreground">${costs.labor.toFixed(2)}</p>
            </div>

            {/* Machinery */}
            <div className="flex items-start justify-between py-2 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Machinery</p>
                <p className="text-xs text-muted mt-0.5">
                  ${costs.breakdown?.purchasePrice.toFixed(0)} / {costs.breakdown?.lifetimeHours.toFixed(0)}h x {costs.breakdown?.printHours.toFixed(2)}h{costs.qty > 1 ? ` ÷ ${costs.qty}` : ''}
                </p>
              </div>
              <p className="text-sm font-bold text-foreground">${costs.machinery.toFixed(2)}</p>
            </div>

            {/* Maintenance */}
            <div className="flex items-start justify-between py-2 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Maintenance</p>
                <p className="text-xs text-muted mt-0.5">
                  ${costs.breakdown?.maintenanceRate.toFixed(2)}/hr x {costs.breakdown?.printHours.toFixed(2)}h{costs.qty > 1 ? ` ÷ ${costs.qty}` : ''}
                </p>
              </div>
              <p className="text-sm font-bold text-foreground">${costs.maintenance.toFixed(2)}</p>
            </div>

            {/* Supplies */}
            <div className="flex items-start justify-between py-2 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Supplies</p>
                <p className="text-xs text-muted mt-0.5">
                  {editForm.supplies.filter(s => s.name.trim()).length > 0
                    ? editForm.supplies.filter(s => s.name.trim()).map((s, i) => <span key={i} className="block">{s.name}: ${(parseFloat(s.cost) || 0).toFixed(2)}{costs.qty > 1 ? ` (÷${costs.qty})` : ''}</span>)
                    : <span>No supplies added</span>
                  }
                </p>
              </div>
              <p className="text-sm font-bold text-foreground">${costs.supplies.toFixed(2)}</p>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-3">
              <p className="text-sm font-bold text-primary uppercase" title="Cost of Goods Sold">Total COGS{costs.qty > 1 ? ` (per item)` : ''}</p>
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
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-elevated text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 text-current opacity-50 hover:opacity-100">&times;</button>
        </div>
      )}

      {/* Header */}
      <h1 className="text-xl font-bold text-foreground uppercase tracking-wide">3D Models</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'TOTAL MODELS', value: String(stats.totalModels) },
          { label: 'AVG LIST PRICE', value: `$${stats.avgListPrice.toFixed(2)}` },
          { label: 'AVG PROFIT / PRINT', value: `$${stats.avgProfit.toFixed(2)}` },
          { label: 'AVG PROFIT / HOUR', value: `$${stats.avgProfitPerHour.toFixed(2)}` },
          { label: 'AVG GROSS MARGIN', value: `${stats.avgGrossMargin.toFixed(1)}%` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4 px-5">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Model Button */}
      <div className="flex justify-end">
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
        <>
          {/* Search / Sort / Filter Bar */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted whitespace-nowrap">Showing {paginatedModels.length} of {filteredModels.length} models</p>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="text"
                  placeholder="Search name or SKU..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                  className="h-9 w-64 rounded-lg border border-border bg-white pl-9 pr-3 text-sm shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 rounded-lg border border-border bg-white px-3 text-sm shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="cost-desc">Cost (High-Low)</option>
                <option value="cost-asc">Cost (Low-High)</option>
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Model Rows */}
          <div className="space-y-2">
            {paginatedModels.map((model) => {
              const isExpanded = expandedRows.has(model.id)
              const ps = model.pricingSummary
              const printHrs = model.printTimeMinutes / 60

              return (
                <div key={model.id} className="rounded-xl border border-border bg-white shadow-xs overflow-hidden">
                  {/* Main Row */}
                  <div
                    className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-surface-raised/50 transition-colors"
                    onClick={() => toggleRow(model.id)}
                  >
                    {/* Checkbox */}
                    <input type="checkbox" className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20" onClick={(e) => e.stopPropagation()} />

                    {/* Thumbnail */}
                    {model.thumbnailUrl || model.imagePath ? (
                      <img
                        src={model.imagePath ? `/api/uploads/images/${model.imagePath}` : model.thumbnailUrl!}
                        alt={model.name}
                        className="h-16 w-16 rounded-lg object-cover border border-border-light shrink-0"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-raised border border-border-light shrink-0">
                        <ImageIcon className="h-6 w-6 text-muted" />
                      </div>
                    )}

                    {/* Name + time */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{model.name}</p>
                      <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatTime(model.printTimeMinutes)}
                      </p>
                    </div>

                    {/* Filament indicator */}
                    {model.filament && (
                      <div className="h-4 w-4 rounded-full bg-green-500 shrink-0" title={model.filament.material} />
                    )}

                    {/* Pricing columns */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-center" title="Cost of Goods Sold">
                        <p className="text-[10px] font-semibold text-muted uppercase">COGS</p>
                        <p className="text-sm font-bold text-foreground">${ps?.totalCost?.toFixed(2) ?? '0.00'}</p>
                      </div>
                      <div className="text-center" title="Average Profit Per Print">
                        <p className="text-[10px] font-semibold text-muted uppercase">Avg. PPP</p>
                        <p className="text-sm font-bold text-foreground">${ps?.avgProfit?.toFixed(2) ?? '0.00'}</p>
                      </div>
                      <div className="text-center" title="Average Profit Per Hour">
                        <p className="text-[10px] font-semibold text-muted uppercase">Avg. PPH</p>
                        <p className="text-sm font-bold text-foreground">${ps?.avgProfitPerHour?.toFixed(2) ?? '0.00'}</p>
                      </div>
                      <div className="text-center" title="Average Gross Profit Margin">
                        <p className="text-[10px] font-semibold text-muted uppercase">Avg. GPM</p>
                        <p className="text-sm font-bold text-foreground">{ps?.avgProfitMargin?.toFixed(1) ?? '0.0'}%</p>
                      </div>
                    </div>

                    {/* Expand / actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary border border-primary/20 hover:bg-primary/5 transition-colors"
                        onClick={(e) => { e.stopPropagation(); openEditModel(model.id) }}
                        title="Edit model"
                      >
                        <Edit className="h-3.5 w-3.5 inline-block mr-1" />Edit
                      </button>
                      <button
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleDelete(model.id) }}
                        title="Delete model"
                      >
                        <Trash2 className="h-3.5 w-3.5 inline-block mr-1" />Delete
                      </button>
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-muted" /> : <ChevronDown className="h-5 w-5 text-muted" />}
                    </div>
                  </div>

                  {/* Expanded: Per-platform pricing */}
                  {isExpanded && ps?.platformPricing && ps.platformPricing.length > 0 && (
                    <div className="border-t border-border bg-surface-raised/30 px-4 py-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                              <th className="text-left py-2 pr-4 w-36">Platform</th>
                              <th className="text-left py-2 px-3">Sale Price</th>
                              <th className="text-left py-2 px-3">COGS</th>
                              <th className="text-left py-2 px-3">Plat. Fees</th>
                              <th className="text-left py-2 px-3">Shipping</th>
                              <th className="text-left py-2 px-3">Profit Per Print</th>
                              <th className="text-left py-2 px-3">Profit Per Hour</th>
                              <th className="text-left py-2 px-3">Gross Profit Margin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ps.platformPricing.map((pp) => {
                              const badge = getPlatformBadge(pp.platformType)
                              const pph = printHrs > 0 ? pp.profit / printHrs : 0
                              return (
                                <tr key={pp.platformId} className="border-t border-border-light">
                                  <td className="py-3 pr-4">
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                                        {badge.label}
                                      </span>
                                      <span className="text-sm text-foreground">{pp.shopName}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 font-semibold text-foreground">${pp.sellingPrice.toFixed(2)}</td>
                                  <td className="py-3 px-3 text-foreground">${ps.totalCost.toFixed(2)}</td>
                                  <td className="py-3 px-3 text-red-600">${pp.platformFees.toFixed(2)}</td>
                                  <td className="py-3 px-3 text-foreground">${ps.shippingCost.toFixed(2)}</td>
                                  <td className="py-3 px-3 font-semibold text-green-600">${pp.profit.toFixed(2)}</td>
                                  <td className="py-3 px-3 font-semibold text-green-600">${pph.toFixed(2)}</td>
                                  <td className="py-3 px-3 font-semibold text-green-600">{pp.profitMargin.toFixed(1)}%</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {isExpanded && (!ps?.platformPricing || ps.platformPricing.length === 0) && (
                    <div className="border-t border-border bg-surface-raised/30 px-4 py-4 text-center text-sm text-muted">
                      No sales platforms configured. Add platforms in <button onClick={() => openEditModel(model.id)} className="text-primary hover:underline">Edit Model</button> or <a href="/dashboard/marketplaces" className="text-primary hover:underline">Marketplaces</a>.
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Page {currentPage} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-raised disabled:opacity-30 disabled:pointer-events-none"
              >&laquo;</button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-raised disabled:opacity-30 disabled:pointer-events-none"
              >&lsaquo;</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
                const page = start + i
                if (page > totalPages) return null
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`rounded px-3 py-1 text-sm font-medium transition-colors ${page === currentPage ? 'border border-primary text-primary bg-white' : 'text-muted hover:bg-surface-raised'}`}
                  >{page}</button>
                )
              })}
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-raised disabled:opacity-30 disabled:pointer-events-none"
              >&rsaquo;</button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-raised disabled:opacity-30 disabled:pointer-events-none"
              >&raquo;</button>
            </div>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="h-8 rounded-lg border border-border bg-white px-2 text-sm shadow-xs"
            >
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
        </>
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
                    <p className="text-sm font-medium text-foreground">Drop a sliced .3mf file or click to browse</p>
                    <p className="text-xs text-muted mt-1">Must be sliced — print time & filament will be extracted automatically</p>
                  </>
                )}
              </div>
              {parseResult && parseResult.printTimeMinutes != null && parseResult.filamentUsageGrams != null && (
                <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>Print time and filament usage auto-filled from {parseResult.slicer || 'file'} metadata. You can adjust below.</span>
                </div>
              )}
              {uploadError && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
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
