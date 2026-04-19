import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import {
  LayoutDashboard, Users, Building2, Settings, Shield,
  ChevronLeft, ChevronRight, ArrowLeft, LogOut, Menu,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Farms', icon: Building2, path: '/admin/farms' },
  { label: 'Platform Settings', icon: Settings, path: '/admin/settings' },
]

export default function AdminLayout() {
  const { user, logout, isImpersonating, stopImpersonation } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const SidebarContent = () => (
    <>
      <div className="flex h-14 items-center justify-between border-b border-slate-700 px-4">
        {!collapsed && (
          <span className="flex items-center gap-2 text-lg font-bold text-white">
            <Shield className="h-5 w-5 text-primary" />
            Admin
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700/70 transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.path === '/admin'
              ? location.pathname === '/admin'
              : location.pathname.startsWith(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                active
                  ? 'bg-primary/15 text-primary shadow-xs'
                  : 'text-slate-400 hover:bg-slate-700/70 hover:text-white',
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-700 p-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-slate-700/70 hover:text-white transition-all duration-150"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
          {!collapsed && 'Back to Dashboard'}
        </Link>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 text-center py-1.5 text-sm font-medium shadow-elevated">
          Impersonating user — {' '}
          <button onClick={stopImpersonation} className="underline font-bold cursor-pointer">
            Stop Impersonation
          </button>
        </div>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - mobile */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-800 transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent />
      </aside>

      {/* Sidebar - desktop */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-slate-800 shrink-0 transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className={cn('flex flex-1 flex-col overflow-hidden', isImpersonating && 'pt-8')}>
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-300 cursor-pointer" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-white">Super Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                {user?.name?.charAt(0)?.toUpperCase() ?? 'A'}
              </div>
              {!collapsed && (
                <span className="text-sm text-slate-300 hidden sm:block">{user?.name}</span>
              )}
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-900 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
