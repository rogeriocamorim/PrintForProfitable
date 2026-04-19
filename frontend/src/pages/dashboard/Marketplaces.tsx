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

export default function Marketplaces() {
  const [platforms, setPlatforms] = useState<SalesPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SalesPlatform | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type: 'ETSY', shopName: '' })

  useEffect(() => {
    api<SalesPlatform[]>('/platforms').then(setPlatforms).finally(() => setLoading(false))
  }, [])

  function openAdd() {
    setEditing(null)
    setForm({ type: 'ETSY', shopName: '' })
    setShowModal(true)
  }

  function openEdit(p: SalesPlatform) {
    setEditing(p)
    setForm({ type: p.type, shopName: p.shopName })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = JSON.stringify({ type: form.type, shopName: form.shopName })
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
              className="flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {PLATFORM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Input label="Shop Name" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} required placeholder="e.g. My Etsy Shop" />
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
