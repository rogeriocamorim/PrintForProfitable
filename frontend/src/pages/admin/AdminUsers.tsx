import { useEffect, useState, useCallback } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { Search, Shield, UserX, UserCheck, Eye } from 'lucide-react'

interface AdminUser {
  id: string
  name: string
  email: string
  role: 'USER' | 'SUPER_ADMIN'
  active: boolean
  provider: string
  createdAt: string
  _count: { farms: number }
}

interface UsersResponse {
  users: AdminUser[]
  total: number
  page: number
  totalPages: number
}

export default function AdminUsers() {
  const { user: currentUser, setAuthFromToken } = useAuth()
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    api<UsersResponse>(`/admin/users?${params}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'SUPER_ADMIN' ? 'USER' : 'SUPER_ADMIN'
    await api(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole }),
    })
    fetchUsers()
  }

  const toggleActive = async (userId: string, isActive: boolean) => {
    await api(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !isActive }),
    })
    fetchUsers()
  }

  const impersonate = async (userId: string) => {
    const res = await api<{ token: string; user: any }>(`/admin/impersonate/${userId}`, {
      method: 'POST',
    })
    setAuthFromToken(res.token, res.user)
    window.location.href = '/dashboard'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">User Management</h2>
        <p className="text-slate-400 mt-1">View and manage all platform users.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="h-10 w-full rounded-lg border border-slate-600 bg-slate-800 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">User</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Role</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Provider</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Farms</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Joined</th>
                <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">Loading...</td>
                </tr>
              ) : !data?.users.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">No users found.</td>
                </tr>
              ) : (
                data.users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-750">
                    <td className="px-5 py-3">
                      <p className="font-medium text-white">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === 'SUPER_ADMIN' ? 'bg-primary/20 text-primary' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-300 capitalize">{u.provider}</td>
                    <td className="px-5 py-3 text-slate-300">{u._count.farms}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {u.id !== currentUser?.id && (
                          <>
                            <button
                              onClick={() => toggleRole(u.id, u.role)}
                              title={u.role === 'SUPER_ADMIN' ? 'Demote to User' : 'Promote to Admin'}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                            >
                              <Shield className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => toggleActive(u.id, u.active)}
                              title={u.active ? 'Deactivate' : 'Activate'}
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                            >
                              {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </button>
                            {u.role !== 'SUPER_ADMIN' && (
                              <button
                                onClick={() => impersonate(u.id)}
                                title="Impersonate"
                                className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-primary cursor-pointer"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                        {u.id === currentUser?.id && (
                          <span className="text-xs text-slate-500 italic">You</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-700 px-5 py-3">
            <p className="text-xs text-slate-400">
              Showing {data.users.length} of {data.total} users
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
