import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import {
  LayoutDashboard, BarChart3, ShoppingCart, ListOrdered, Box, Printer,
  Palette, Users, Settings, Truck, Package, Store, Puzzle,
  Search, Bell, ChevronLeft, ChevronRight, LogOut, Menu, Shield,
} from 'lucide-react'

const SECTIONS = [
  {
    title: 'ANALYTICS',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { label: 'Product Analytics', icon: BarChart3, path: '/dashboard/analytics' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Orders', icon: ShoppingCart, path: '/dashboard/orders' },
      { label: 'Print Queue', icon: ListOrdered, path: '/dashboard/queue' },
      { label: '3D Models', icon: Box, path: '/dashboard/models' },
      { label: 'Printers', icon: Printer, path: '/dashboard/printers' },
      { label: 'Filaments', icon: Palette, path: '/dashboard/filaments' },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      { label: 'Users', icon: Users, path: '/dashboard/users' },
      { label: 'Farm Settings', icon: Settings, path: '/dashboard/settings' },
      { label: 'Shipping', icon: Truck, path: '/dashboard/shipping' },
      { label: 'Supplies', icon: Package, path: '/dashboard/supplies' },
      { label: 'Marketplaces', icon: Store, path: '/dashboard/marketplaces' },
      { label: 'Integrations', icon: Puzzle, path: '/dashboard/integrations' },
    ],
  },
]

export default function DashboardLayout() {
  const { user, logout, isAdmin, isImpersonating, stopImpersonation } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
        {!collapsed && (
          <span className="text-lg font-bold text-dark">
            Print<span className="text-primary">For</span>Profitable
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 cursor-pointer"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-3 mb-2 text-xs font-semibold text-muted uppercase tracking-wider">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.path === '/dashboard'
                    ? location.pathname === '/dashboard'
                    : location.pathname.startsWith(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Admin link */}
      {isAdmin && !isImpersonating && (
        <div className="border-t border-gray-200 p-3">
          <Link
            to="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <Shield className="h-5 w-5 shrink-0" />
            {!collapsed && 'Admin Panel'}
          </Link>
        </div>
      )}
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-yellow-500 text-yellow-900 text-center py-1 text-sm font-medium">
          Impersonating {user?.name} — {' '}
          <button onClick={stopImpersonation} className="underline font-bold cursor-pointer">
            Stop Impersonation
          </button>
        </div>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - mobile */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-gray-200 transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent />
      </aside>

      {/* Sidebar - desktop */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-white border-r border-gray-200 shrink-0 transition-all',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-gray-600 cursor-pointer"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-12 text-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400 font-mono">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 cursor-pointer">
              <Bell className="h-5 w-5" />
            </button>
            <div className="relative group">
              <button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100 cursor-pointer">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                  {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
              </button>
              <div className="absolute right-0 top-full mt-1 hidden w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg group-hover:block">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-muted">{user?.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
