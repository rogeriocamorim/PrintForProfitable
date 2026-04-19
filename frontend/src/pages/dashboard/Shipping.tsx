import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Card, CardContent } from '../../components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Plus, Trash2, Pencil, Loader2, Truck } from 'lucide-react'

interface ShippingProfile {
  id: string
  name: string
  customerPays: number
  postageCost: number
  deliveryMinDays: number
  deliveryMaxDays: number
  createdAt: string
}

export default function Shipping() {
  const [profiles, setProfiles] = useState<ShippingProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ShippingProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', customerPays: '5.99', postageCost: '5.00', deliveryMinDays: '3', deliveryMaxDays: '5',
  })

  useEffect(() => {
    api<ShippingProfile[]>('/shipping').then(setProfiles).finally(() => setLoading(false))
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ name: '', customerPays: '5.99', postageCost: '5.00', deliveryMinDays: '3', deliveryMaxDays: '5' })
    setShowModal(true)
  }

  function openEdit(s: ShippingProfile) {
    setEditing(s)
    setForm({
      name: s.name, customerPays: String(s.customerPays), postageCost: String(s.postageCost),
      deliveryMinDays: String(s.deliveryMinDays), deliveryMaxDays: String(s.deliveryMaxDays),
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = JSON.stringify({
        name: form.name, customerPays: parseFloat(form.customerPays), postageCost: parseFloat(form.postageCost),
        deliveryMinDays: parseInt(form.deliveryMinDays), deliveryMaxDays: parseInt(form.deliveryMaxDays),
      })
      if (editing) {
        const updated = await api<ShippingProfile>(`/shipping/${editing.id}`, { method: 'PUT', body })
        setProfiles(profiles.map((p) => p.id === updated.id ? updated : p))
      } else {
        const created = await api<ShippingProfile>('/shipping', { method: 'POST', body })
        setProfiles([created, ...profiles])
      }
      setShowModal(false)
    } catch {
      // error
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this shipping profile?')) return
    try {
      await api(`/shipping/${id}`, { method: 'DELETE' })
      setProfiles(profiles.filter((p) => p.id !== id))
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
          <h1 className="text-2xl font-bold text-foreground">Shipping Profiles</h1>
          <p className="text-sm text-muted mt-1">{profiles.length} profile{profiles.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Profile</Button>
      </div>

      {profiles.length === 0 ? (
        <Card><CardContent>
          <EmptyState
            icon={<Truck className="h-12 w-12" />}
            title="No shipping profiles yet"
            description="Add shipping profiles to factor delivery costs into your pricing"
            action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Profile</Button>}
          />
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Customer Pays</TableHead>
                <TableHead className="text-right">Your Cost</TableHead>
                <TableHead className="text-right">Delivery</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                  <TableCell className="text-right">${p.customerPays.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${p.postageCost.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-muted">{p.deliveryMinDays}-{p.deliveryMaxDays} days</TableCell>
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Shipping Profile' : 'Add Shipping Profile'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Profile Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Standard Shipping" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Customer Pays" type="number" step="0.01" prefix="$" value={form.customerPays} onChange={(e) => setForm({ ...form, customerPays: e.target.value })} required />
            <Input label="Your Postage Cost" type="number" step="0.01" prefix="$" value={form.postageCost} onChange={(e) => setForm({ ...form, postageCost: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min Delivery Days" type="number" value={form.deliveryMinDays} onChange={(e) => setForm({ ...form, deliveryMinDays: e.target.value })} required />
            <Input label="Max Delivery Days" type="number" value={form.deliveryMaxDays} onChange={(e) => setForm({ ...form, deliveryMaxDays: e.target.value })} required />
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
