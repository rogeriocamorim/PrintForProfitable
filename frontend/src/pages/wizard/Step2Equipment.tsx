import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent } from '../../components/ui/Card'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'

interface Printer {
  id: string
  brand: string
  model: string
  powerConsumption: string
  purchasePrice: string
  expectedLifetimeHours: string
}

interface Filament {
  id: string
  materialType: string
  brand: string
  color: string
  costPerSpool: string
  spoolWeight: string
}

const COLORS = [
  '#000000', '#ffffff', '#e53e3e', '#dd6b20', '#d69e2e', '#38a169',
  '#3182ce', '#805ad5', '#d53f8c', '#718096', '#2d3748', '#ecc94b',
]

export default function Step2Equipment() {
  const navigate = useNavigate()
  const [printers, setPrinters] = useState<Printer[]>([])
  const [filaments, setFilaments] = useState<Filament[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addPrinter = () => {
    setPrinters([...printers, { id: Date.now().toString(), brand: '', model: '', powerConsumption: '', purchasePrice: '', expectedLifetimeHours: '5000' }])
  }

  const removePrinter = (id: string) => setPrinters(printers.filter((p) => p.id !== id))

  const updatePrinter = (id: string, field: keyof Omit<Printer, 'id'>, value: string) => {
    setPrinters(printers.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const addFilament = () => {
    setFilaments([
      ...filaments,
      { id: Date.now().toString(), materialType: 'PLA', brand: '', color: '#000000', costPerSpool: '', spoolWeight: '1000' },
    ])
  }

  const removeFilament = (id: string) => setFilaments(filaments.filter((f) => f.id !== id))

  const updateFilament = (id: string, field: keyof Omit<Filament, 'id'>, value: string) => {
    setFilaments(filaments.map((f) => (f.id === id ? { ...f, [field]: value } : f)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/wizard/step2', {
        method: 'PUT',
        body: JSON.stringify({
          printers: printers.map((p) => ({
            brand: p.brand,
            model: p.model,
            powerConsumption: parseFloat(p.powerConsumption) || 200,
            purchasePrice: parseFloat(p.purchasePrice) || 0,
            expectedLifetimeHours: parseFloat(p.expectedLifetimeHours) || 5000,
          })),
          filaments: filaments.map((f) => ({
            brand: f.brand,
            material: f.materialType,
            variant: f.materialType,
            costPerSpool: parseFloat(f.costPerSpool) || 19.99,
            spoolWeight: parseInt(f.spoolWeight) || 1000,
            colors: [f.color],
          })),
        }),
      })
      navigate('/setup/sales')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save equipment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="flex flex-col justify-center">
          <h1 className="text-3xl font-bold text-foreground mb-3 tracking-tight">Add your equipment</h1>
          <p className="text-muted text-lg leading-relaxed">
            Add your printers and filaments so we can calculate accurate material and energy costs for each print.
          </p>
        </div>

        <div className="space-y-6">
          {/* Printers */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Printers</h3>
                <Button type="button" variant="outline" size="sm" onClick={addPrinter}>
                  <Plus className="h-4 w-4" /> Add Printer
                </Button>
              </div>
              {printers.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">No printers added yet</p>
              ) : (
                <div className="space-y-4">
                  {printers.map((p) => (
                    <div key={p.id} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="grid grid-cols-2 gap-3 flex-1">
                          <Input
                            placeholder="Brand"
                            value={p.brand}
                            onChange={(e) => updatePrinter(p.id, 'brand', e.target.value)}
                          />
                          <Input
                            placeholder="Model"
                            value={p.model}
                            onChange={(e) => updatePrinter(p.id, 'model', e.target.value)}
                          />
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removePrinter(p.id)}>
                          <Trash2 className="h-4 w-4 text-muted" />
                        </Button>
                      </div>
                      <Input
                        label="Power Consumption"
                        type="number"
                        placeholder="200"
                        suffix="W"
                        value={p.powerConsumption}
                        onChange={(e) => updatePrinter(p.id, 'powerConsumption', e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Purchase Price"
                          type="number"
                          step="0.01"
                          prefix="$"
                          placeholder="299"
                          value={p.purchasePrice}
                          onChange={(e) => updatePrinter(p.id, 'purchasePrice', e.target.value)}
                        />
                        <Input
                          label="Expected Lifetime"
                          type="number"
                          suffix="hours"
                          placeholder="5000"
                          value={p.expectedLifetimeHours}
                          onChange={(e) => updatePrinter(p.id, 'expectedLifetimeHours', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filaments */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Filaments</h3>
              </div>
              {filaments.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">No filaments added yet</p>
              ) : (
                <div className="space-y-4">
                  {filaments.map((f) => (
                    <div key={f.id} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="grid grid-cols-2 gap-3 flex-1">
                          <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-foreground">Material</label>
                            <select
                              className="flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                              value={f.materialType}
                              onChange={(e) => updateFilament(f.id, 'materialType', e.target.value)}
                            >
                              <option>PLA</option>
                              <option>PETG</option>
                              <option>ABS</option>
                              <option>TPU</option>
                              <option>Nylon</option>
                              <option>ASA</option>
                            </select>
                          </div>
                          <Input
                            label="Brand"
                            placeholder="Brand"
                            value={f.brand}
                            onChange={(e) => updateFilament(f.id, 'brand', e.target.value)}
                          />
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeFilament(f.id)} className="mt-6">
                          <Trash2 className="h-4 w-4 text-muted" />
                        </Button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Color</label>
                        <div className="flex flex-wrap gap-2">
                          {COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => updateFilament(f.id, 'color', c)}
                              className={`h-7 w-7 rounded-full border-2 cursor-pointer transition-all duration-150 ${
                                f.color === c ? 'border-primary scale-110 shadow-xs' : 'border-border hover:border-muted'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Cost per Spool"
                          type="number"
                          step="0.01"
                          prefix="$"
                          placeholder="25.00"
                          value={f.costPerSpool}
                          onChange={(e) => updateFilament(f.id, 'costPerSpool', e.target.value)}
                        />
                        <Input
                          label="Spool Weight"
                          type="number"
                          suffix="g"
                          placeholder="1000"
                          value={f.spoolWeight}
                          onChange={(e) => updateFilament(f.id, 'spoolWeight', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={addFilament}
                className="mt-4 text-sm font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer"
              >
                + Manually Add Filament
              </button>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
            )}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate('/setup/sales')}
                className="text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                I'll set this up later
              </button>
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? 'Saving...' : 'Continue'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
