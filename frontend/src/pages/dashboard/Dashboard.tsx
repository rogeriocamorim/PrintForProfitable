import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { Card, CardContent } from '../../components/ui/Card'
import { Loader2, Box, Cpu, Palette, Store, Truck, DollarSign, TrendingUp, Zap } from 'lucide-react'

interface Farm {
  id: string
  name: string
  electricityRate: number
  laborRate: number
  targetProfitMargin: number
  taxRates: { id: string; name: string; rate: number }[]
  printers: { id: string }[]
  filaments: { id: string }[]
  salesPlatforms: { id: string; enabled: boolean }[]
  shippingProfiles: { id: string }[]
  models: { id: string; name: string; calculatedCost: number; suggestedPrice: number; createdAt: string }[]
}

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  href?: string
  sub?: string
}

function StatCard({ label, value, icon, href, sub }: StatCardProps) {
  const navigate = useNavigate()
  return (
    <Card
      className={href ? 'cursor-pointer hover:border-primary/30 transition-colors' : ''}
      onClick={href ? () => navigate(href) : undefined}
    >
      <CardContent className="flex items-center gap-4 py-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const [farm, setFarm] = useState<Farm | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<Farm>('/farms')
      .then(setFarm)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (!farm) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Card><CardContent className="py-12 text-center">
          <p className="text-muted">No farm found. Complete the setup wizard first.</p>
        </CardContent></Card>
      </div>
    )
  }

  const activePlatforms = farm.salesPlatforms.filter((p) => p.enabled).length
  const totalRevenue = farm.models.reduce((sum, m) => sum + m.suggestedPrice, 0)
  const totalCost = farm.models.reduce((sum, m) => sum + m.calculatedCost, 0)
  const recentModels = farm.models.slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{farm.name}</h1>
        <p className="text-sm text-muted mt-1">Overview of your print farm</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="3D Models"
          value={farm.models.length}
          icon={<Box className="h-6 w-6 text-primary" />}
          href="/dashboard/models"
        />
        <StatCard
          label="Printers"
          value={farm.printers.length}
          icon={<Cpu className="h-6 w-6 text-primary" />}
          href="/dashboard/printers"
        />
        <StatCard
          label="Filaments"
          value={farm.filaments.length}
          icon={<Palette className="h-6 w-6 text-primary" />}
          href="/dashboard/filaments"
        />
        <StatCard
          label="Marketplaces"
          value={activePlatforms}
          icon={<Store className="h-6 w-6 text-primary" />}
          href="/dashboard/marketplaces"
          sub={`${farm.salesPlatforms.length} total`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Profit Margin"
          value={`${farm.targetProfitMargin}%`}
          icon={<TrendingUp className="h-6 w-6 text-primary" />}
          href="/dashboard/settings"
        />
        <StatCard
          label="Electricity Rate"
          value={`$${farm.electricityRate}/kWh`}
          icon={<Zap className="h-6 w-6 text-primary" />}
          href="/dashboard/settings"
        />
        <StatCard
          label="Est. Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          icon={<DollarSign className="h-6 w-6 text-primary" />}
          sub={`$${totalCost.toFixed(2)} in costs`}
        />
      </div>

      {recentModels.length > 0 && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Models</h2>
            <div className="space-y-3">
              {recentModels.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <p className="text-xs text-muted">Cost: ${m.calculatedCost.toFixed(2)}</p>
                  </div>
                  <p className="text-sm font-semibold text-primary">${m.suggestedPrice.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
