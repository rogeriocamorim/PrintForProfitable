import { useEffect, useState, useCallback } from 'react'
import { api } from '../../lib/api'
import { Link } from 'react-router-dom'

interface AdminFarm {
  id: string
  name: string
  electricityRate: number
  laborRate: number
  targetProfitMargin: number
  createdAt: string
  user: { id: string; name: string; email: string }
  _count: { printers: number; filaments: number; models: number; salesPlatforms: number }
}

interface FarmsResponse {
  farms: AdminFarm[]
  total: number
  page: number
  totalPages: number
}

export default function AdminFarms() {
  const [data, setData] = useState<FarmsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const fetchFarms = useCallback(() => {
    setLoading(true)
    api<FarmsResponse>(`/admin/farms?page=${page}&limit=20`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { fetchFarms() }, [fetchFarms])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Farm Management</h2>
        <p className="text-slate-400 mt-1">View all farms across the platform.</p>
      </div>

      <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Farm</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Owner</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Printers</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Filaments</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Models</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Platforms</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Rates</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">Loading...</td>
                </tr>
              ) : !data?.farms.length ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">No farms found.</td>
                </tr>
              ) : (
                data.farms.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-750">
                    <td className="px-5 py-3 font-medium text-white">{f.name}</td>
                    <td className="px-5 py-3">
                      <Link to={`/admin/users`} className="text-primary hover:underline text-xs">
                        {f.user.name}
                      </Link>
                      <p className="text-xs text-slate-400">{f.user.email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-300">{f._count.printers}</td>
                    <td className="px-5 py-3 text-slate-300">{f._count.filaments}</td>
                    <td className="px-5 py-3 text-slate-300">{f._count.models}</td>
                    <td className="px-5 py-3 text-slate-300">{f._count.salesPlatforms}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      ${f.electricityRate}/kWh &middot; ${f.laborRate}/hr &middot; {f.targetProfitMargin}%
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-700 px-5 py-3">
            <p className="text-xs text-slate-400">
              Showing {data.farms.length} of {data.total} farms
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded px-3 py-1 text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded px-3 py-1 text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
