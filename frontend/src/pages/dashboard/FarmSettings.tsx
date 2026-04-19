import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Card, CardHeader, CardContent } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Trash2, Plus, Settings, Loader2 } from 'lucide-react'

interface TaxRate {
  id: string
  name: string
  rate: number
}

interface Farm {
  id: string
  name: string
  electricityRate: number
  laborRate: number
  targetProfitMargin: number
  taxRates: TaxRate[]
}

export default function FarmSettings() {
  const [farm, setFarm] = useState<Farm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    name: '',
    electricityRate: '',
    laborRate: '',
    targetProfitMargin: '',
  })
  const [newTax, setNewTax] = useState({ name: '', rate: '' })

  useEffect(() => {
    loadFarm()
  }, [])

  async function loadFarm() {
    try {
      const data = await api<Farm>('/farms')
      setFarm(data)
      setForm({
        name: data.name,
        electricityRate: String(parseFloat(data.electricityRate.toFixed(4))),
        laborRate: String(parseFloat(data.laborRate.toFixed(2))),
        targetProfitMargin: String(parseFloat(data.targetProfitMargin.toFixed(2))),
      })
    } catch {
      setMessage('Failed to load farm settings')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const data = await api<Farm>('/farms', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          electricityRate: parseFloat(form.electricityRate),
          laborRate: parseFloat(form.laborRate),
          targetProfitMargin: parseFloat(form.targetProfitMargin),
        }),
      })
      setFarm(data)
      setMessage('Settings saved successfully')
    } catch {
      setMessage('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function addTaxRate() {
    if (!newTax.name || !newTax.rate) return
    try {
      const taxRate = await api<TaxRate>('/farms/tax-rates', {
        method: 'POST',
        body: JSON.stringify({
          name: newTax.name,
          rate: parseFloat(newTax.rate),
        }),
      })
      setFarm((f) => f ? { ...f, taxRates: [...f.taxRates, taxRate] } : f)
      setNewTax({ name: '', rate: '' })
    } catch {
      setMessage('Failed to add tax rate')
    }
  }

  async function removeTaxRate(id: string) {
    try {
      await api(`/farms/tax-rates/${id}`, { method: 'DELETE' })
      setFarm((f) => f ? { ...f, taxRates: f.taxRates.filter((t) => t.id !== id) } : f)
    } catch {
      setMessage('Failed to remove tax rate')
    }
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Farm Settings</h1>
        <p className="text-sm text-muted mt-1">Manage your farm's pricing parameters and tax rates</p>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <Input
                label="Farm Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="Electricity Rate"
                type="number"
                step="0.01"
                prefix="$"
                suffix="/kWh"
                value={form.electricityRate}
                onChange={(e) => setForm({ ...form, electricityRate: e.target.value })}
              />
              <Input
                label="Labor Rate"
                type="number"
                step="0.01"
                prefix="$"
                suffix="/hr"
                value={form.laborRate}
                onChange={(e) => setForm({ ...form, laborRate: e.target.value })}
              />
              <Input
                label="Target Profit Margin"
                type="number"
                step="0.1"
                suffix="%"
                value={form.targetProfitMargin}
                onChange={(e) => setForm({ ...form, targetProfitMargin: e.target.value })}
              />
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Settings
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Tax Rates</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {farm?.taxRates.map((tax) => (
                <div key={tax.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{tax.name}</span>
                    <span className="ml-2 text-sm text-muted">{tax.rate}%</span>
                  </div>
                  <button
                    onClick={() => removeTaxRate(tax.id)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {farm?.taxRates.length === 0 && (
                <p className="text-sm text-muted py-2">No tax rates configured</p>
              )}
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="Tax name"
                  value={newTax.name}
                  onChange={(e) => setNewTax({ ...newTax, name: e.target.value })}
                />
                <Input
                  placeholder="Rate"
                  type="number"
                  step="0.01"
                  suffix="%"
                  value={newTax.rate}
                  onChange={(e) => setNewTax({ ...newTax, rate: e.target.value })}
                  className="w-28"
                />
                <Button variant="outline" size="icon" onClick={addTaxRate} type="button">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
