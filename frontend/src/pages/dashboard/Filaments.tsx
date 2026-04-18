import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Card, CardContent } from '../../components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Plus, Trash2, Pencil, Loader2, Palette } from 'lucide-react'

interface Filament {
  id: string
  brand: string
  material: string
  variant: string
  costPerSpool: number
  spoolWeight: number
  colors: string[]
  createdAt: string
}

export default function Filaments() {
  const [filaments, setFilaments] = useState<Filament[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Filament | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    brand: '', material: 'PLA', variant: '', costPerSpool: '19.99', spoolWeight: '1000',
  })

  useEffect(() => {
    api<Filament[]>('/filaments').then(setFilaments).finally(() => setLoading(false))
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ brand: '', material: 'PLA', variant: '', costPerSpool: '19.99', spoolWeight: '1000' })
    setShowModal(true)
  }

  function openEdit(f: Filament) {
    setEditing(f)
    setForm({
      brand: f.brand, material: f.material, variant: f.variant,
      costPerSpool: String(f.costPerSpool), spoolWeight: String(f.spoolWeight),
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = JSON.stringify({
        brand: form.brand, material: form.material, variant: form.variant,
        costPerSpool: parseFloat(form.costPerSpool), spoolWeight: parseFloat(form.spoolWeight),
      })
      if (editing) {
        const updated = await api<Filament>(`/filaments/${editing.id}`, { method: 'PUT', body })
        setFilaments(filaments.map((f) => f.id === updated.id ? updated : f))
      } else {
        const created = await api<Filament>('/filaments', { method: 'POST', body })
        setFilaments([created, ...filaments])
      }
      setShowModal(false)
    } catch {
      // error
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this filament?')) return
    try {
      await api(`/filaments/${id}`, { method: 'DELETE' })
      setFilaments(filaments.filter((f) => f.id !== id))
    } catch {
      // error
    }
  }

  const materialColors: Record<string, 'info' | 'success' | 'warning' | 'primary' | 'default'> = {
    PLA: 'info', PETG: 'success', ABS: 'warning', TPU: 'primary',
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Filaments</h1>
          <p className="text-sm text-muted mt-1">{filaments.length} filament{filaments.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Filament</Button>
      </div>

      {filaments.length === 0 ? (
        <Card><CardContent>
          <EmptyState
            icon={<Palette className="h-12 w-12" />}
            title="No filaments yet"
            description="Add your filament stock to accurately calculate material costs"
            action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Filament</Button>}
          />
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Brand</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Cost/Spool</TableHead>
                <TableHead className="text-right">Spool Weight</TableHead>
                <TableHead className="text-right">$/gram</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {filaments.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium text-gray-900">{f.brand}</TableCell>
                  <TableCell><Badge variant={materialColors[f.material] ?? 'default'}>{f.material}</Badge></TableCell>
                  <TableCell>{f.variant}</TableCell>
                  <TableCell className="text-right">${f.costPerSpool.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{f.spoolWeight}g</TableCell>
                  <TableCell className="text-right text-muted">${(f.costPerSpool / f.spoolWeight).toFixed(4)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(f)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(f.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Filament' : 'Add Filament'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required placeholder="e.g. Bambu Lab" />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Material</label>
            <select
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.value })}
            >
              {['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Nylon', 'PC', 'PVA', 'HIPS', 'Other'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <Input label="Variant" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} required placeholder="e.g. Matte Black" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cost per Spool" type="number" step="0.01" prefix="$" value={form.costPerSpool} onChange={(e) => setForm({ ...form, costPerSpool: e.target.value })} required />
            <Input label="Spool Weight" type="number" suffix="grams" value={form.spoolWeight} onChange={(e) => setForm({ ...form, spoolWeight: e.target.value })} required />
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
