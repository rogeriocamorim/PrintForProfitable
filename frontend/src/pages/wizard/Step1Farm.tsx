import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent } from '../../components/ui/Card'
import { Trash2, Plus } from 'lucide-react'
import { api } from '../../lib/api'

interface TaxRate {
  id: string
  name: string
  rate: string
}

export default function Step1Farm() {
  const navigate = useNavigate()
  const [farmName, setFarmName] = useState('')
  const [electricityRate, setElectricityRate] = useState('')
  const [laborRate, setLaborRate] = useState('')
  const [profitMargin, setProfitMargin] = useState('30')
  const [taxRates, setTaxRates] = useState<TaxRate[]>([
    { id: '1', name: 'Sales Tax', rate: '' },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addTaxRate = () => {
    setTaxRates([...taxRates, { id: Date.now().toString(), name: '', rate: '' }])
  }

  const removeTaxRate = (id: string) => {
    setTaxRates(taxRates.filter((t) => t.id !== id))
  }

  const updateTaxRate = (id: string, field: 'name' | 'rate', value: string) => {
    setTaxRates(taxRates.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/wizard/step1', {
        method: 'PUT',
        body: JSON.stringify({
          name: farmName,
          electricityRate: parseFloat(electricityRate) || 0.12,
          laborRate: parseFloat(laborRate) || 60,
          targetProfitMargin: parseFloat(profitMargin) || 30,
          taxRates: taxRates
            .filter((t) => t.name && t.rate)
            .map((t) => ({ name: t.name, rate: parseFloat(t.rate) })),
        }),
      })
      navigate('/setup/equipment')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save farm settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="flex flex-col justify-center">
          <h1 className="text-3xl font-bold text-foreground mb-3 tracking-tight">Set up your farm</h1>
          <p className="text-muted text-lg leading-relaxed">
            Tell us about your print farm so we can calculate accurate costs and help you price your products profitably.
          </p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Farm Name"
                placeholder="My Print Farm"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                required
              />

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Cost Defaults</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Electricity Rate"
                    type="number"
                    step="0.01"
                    placeholder="0.12"
                    prefix="$"
                    suffix="/kWh"
                    value={electricityRate}
                    onChange={(e) => setElectricityRate(e.target.value)}
                  />
                  <Input
                    label="Labor Rate"
                    type="number"
                    step="0.01"
                    placeholder="15.00"
                    prefix="$"
                    suffix="/hr"
                    value={laborRate}
                    onChange={(e) => setLaborRate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Sales Tax Rates</h3>
                  <button
                    type="button"
                    onClick={addTaxRate}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
                <div className="space-y-3">
                  {taxRates.map((tax) => (
                    <div key={tax.id} className="flex items-end gap-3">
                      <div className="flex-1">
                        <Input
                          placeholder="Tax name"
                          value={tax.name}
                          onChange={(e) => updateTaxRate(tax.id, 'name', e.target.value)}
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          suffix="%"
                          value={tax.rate}
                          onChange={(e) => updateTaxRate(tax.id, 'rate', e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTaxRate(tax.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Pricing Goal</h3>
                <Input
                  label="Target Profit Margin"
                  type="number"
                  step="1"
                  placeholder="30"
                  suffix="%"
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(e.target.value)}
                />
                <p className="mt-2 text-xs text-muted">
                  We'll use this to automatically calculate suggested prices for your products based on total costs.
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Saving...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
