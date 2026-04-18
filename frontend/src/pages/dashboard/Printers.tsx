import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Card, CardHeader, CardContent } from '../../components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Plus, Trash2, Pencil, Loader2, Cpu } from 'lucide-react'

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
          <h1 className="text-2xl font-bold text-gray-900">Printers</h1>
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
                  <TableCell className="font-medium text-gray-900">{p.brand}</TableCell>
                  <TableCell>{p.model}</TableCell>
                  <TableCell className="text-right">{p.powerConsumption}W</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(p.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
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
