import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { Users, Building2, Box, Printer, Palette } from 'lucide-react'

interface Stats {
  totalUsers: number
  totalFarms: number
  totalModels: number
  totalPrinters: number
  totalFilaments: number
  recentUsers: { id: string; name: string; email: string; role: string; createdAt: string }[]
}

const STAT_CARDS = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, color: 'bg-blue-500' },
  { key: 'totalFarms', label: 'Total Farms', icon: Building2, color: 'bg-green-500' },
  { key: 'totalModels', label: '3D Models', icon: Box, color: 'bg-purple-500' },
  { key: 'totalPrinters', label: 'Printers', icon: Printer, color: 'bg-orange-500' },
  { key: 'totalFilaments', label: 'Filaments', icon: Palette, color: 'bg-pink-500' },
] as const

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<Stats>('/admin/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!stats) {
    return <p className="text-slate-400">Failed to load stats.</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">System Overview</h2>
        <p className="text-slate-400 mt-1">Platform-wide statistics at a glance.</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className="rounded-xl bg-slate-800 border border-slate-700 p-5 transition-colors duration-200">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}/20`}>
                <card.icon className={`h-5 w-5 text-${card.color.replace('bg-', '')}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats[card.key].toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent users */}
      <div className="rounded-xl bg-slate-800 border border-slate-700">
        <div className="border-b border-slate-700 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">Recent Users</h3>
        </div>
        <div className="divide-y divide-slate-700">
          {stats.recentUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-5 py-3 transition-colors duration-150 hover:bg-slate-750">
              <div>
                <p className="text-sm font-medium text-white">{u.name}</p>
                <p className="text-xs text-slate-400">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.role === 'SUPER_ADMIN'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {u.role}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
