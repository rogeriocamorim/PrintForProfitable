import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Card, CardContent } from '../../components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Plus, Trash2, Pencil, Loader2, Cpu } from 'lucide-react'

interface PrinterPreset {
  brand: string
  model: string
  powerConsumption: number
}

const PRINTER_PRESETS: PrinterPreset[] = [
  // Bambu Lab
  { brand: 'Bambu Lab', model: 'A1 Mini', powerConsumption: 100 },
  { brand: 'Bambu Lab', model: 'A1', powerConsumption: 120 },
  { brand: 'Bambu Lab', model: 'P1P', powerConsumption: 150 },
  { brand: 'Bambu Lab', model: 'P1S', powerConsumption: 150 },
  { brand: 'Bambu Lab', model: 'X1', powerConsumption: 180 },
  { brand: 'Bambu Lab', model: 'X1C', powerConsumption: 180 },
  { brand: 'Bambu Lab', model: 'X1E', powerConsumption: 200 },
  { brand: 'Bambu Lab', model: 'P2S', powerConsumption: 200 },
  { brand: 'Bambu Lab', model: 'X2D', powerConsumption: 250 },
  { brand: 'Bambu Lab', model: 'H2C', powerConsumption: 200 },
  // Prusa
  { brand: 'Prusa', model: 'Mini+', powerConsumption: 80 },
  { brand: 'Prusa', model: 'MK3S+', powerConsumption: 120 },
  { brand: 'Prusa', model: 'MK4S', powerConsumption: 120 },
  // Creality
  { brand: 'Creality', model: 'Ender 3 V3', powerConsumption: 150 },
  { brand: 'Creality', model: 'K1', powerConsumption: 150 },
  { brand: 'Creality', model: 'K1 Max', powerConsumption: 200 },
  // Voron
  { brand: 'Voron', model: '2.4 (350mm)', powerConsumption: 250 },
  // Elegoo
  { brand: 'Elegoo', model: 'Neptune 4', powerConsumption: 150 },
  { brand: 'Elegoo', model: 'Saturn 3 Ultra (Resin)', powerConsumption: 60 },
]

interface Printer {
  id: string
  brand: string
  model: string
  powerConsumption: number
  imageUrl: string | null
  createdAt: string
}

export default function Printers() {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Printer | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ brand: '', model: '', powerConsumption: '200' })

  useEffect(() => {
    api<Printer[]>('/printers').then(setPrinters).finally(() => setLoading(false))
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ brand: '', model: '', powerConsumption: '200' })
    setShowModal(true)
  }

  function openEdit(p: Printer) {
    setEditing(p)
    setForm({ brand: p.brand, model: p.model, powerConsumption: String(p.powerConsumption) })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = JSON.stringify({
        brand: form.brand,
        model: form.model,
        powerConsumption: parseFloat(form.powerConsumption),
      })
      if (editing) {
        const updated = await api<Printer>(`/printers/${editing.id}`, { method: 'PUT', body })
        setPrinters(printers.map((p) => p.id === updated.id ? updated : p))
      } else {
        const created = await api<Printer>('/printers', { method: 'POST', body })
        setPrinters([created, ...printers])
      }
      setShowModal(false)
    } catch {
      // error
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this printer?')) return
    try {
      await api(`/printers/${id}`, { method: 'DELETE' })
      setPrinters(printers.filter((p) => p.id !== id))
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
          <h1 className="text-2xl font-bold text-foreground">Printers</h1>
          <p className="text-sm text-muted mt-1">{printers.length} printer{printers.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Printer</Button>
      </div>

      {printers.length === 0 ? (
        <Card><CardContent>
          <EmptyState
            icon={<Cpu className="h-12 w-12" />}
            title="No printers yet"
            description="Add your 3D printers to track power consumption and costs"
            action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Printer</Button>}
          />
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Brand</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Power (W)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {printers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-foreground">{p.brand}</TableCell>
                  <TableCell>{p.model}</TableCell>
                  <TableCell className="text-right">{p.powerConsumption}W</TableCell>
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Printer' : 'Add Printer'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Quick Select Preset</label>
              <select
                className="flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                value=""
                onChange={(e) => {
                  const preset = PRINTER_PRESETS[parseInt(e.target.value)]
                  if (preset) {
                    setForm({
                      brand: preset.brand,
                      model: preset.model,
                      powerConsumption: String(preset.powerConsumption),
                    })
                  }
                }}
              >
                <option value="">Choose a printer or fill manually...</option>
                {(() => {
                  const groups: Record<string, { preset: PrinterPreset; index: number }[]> = {}
                  PRINTER_PRESETS.forEach((p, i) => {
                    if (!groups[p.brand]) groups[p.brand] = []
                    groups[p.brand].push({ preset: p, index: i })
                  })
                  return Object.entries(groups).map(([brand, items]) => (
                    <optgroup key={brand} label={brand}>
                      {items.map(({ preset, index }) => (
                        <option key={index} value={index}>
                          {preset.model} — {preset.powerConsumption}W avg
                        </option>
                      ))}
                    </optgroup>
                  ))
                })()}
              </select>
            </div>
          )}
          <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required placeholder="e.g. Bambu Lab" />
          <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required placeholder="e.g. X1 Carbon" />
          <Input label="Power Consumption" type="number" suffix="watts" value={form.powerConsumption} onChange={(e) => setForm({ ...form, powerConsumption: e.target.value })} required />
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
