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
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <span className="text-lg font-bold text-dark">
            Print<span className="text-primary">For</span>Profitable
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-raised hover:text-foreground transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold text-muted/70 uppercase tracking-widest">
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
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                      active
                        ? 'bg-primary/10 text-primary shadow-xs'
                        : 'text-muted hover:bg-surface-raised hover:text-foreground',
                    )}
                  >
                    <item.icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
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
        <div className="border-t border-border p-3">
          <Link
            to="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-primary hover:bg-primary/10 transition-all duration-150"
          >
            <Shield className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && 'Admin Panel'}
          </Link>
        </div>
      )}
    </>
  )

  return (
    <div className="flex h-screen bg-surface-raised">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 text-center py-1.5 text-sm font-medium shadow-elevated">
          Impersonating {user?.name} — {' '}
          <button onClick={stopImpersonation} className="underline font-bold cursor-pointer">
            Stop Impersonation
          </button>
        </div>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - mobile */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-border shadow-dropdown transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent />
      </aside>

      {/* Sidebar - desktop */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-white border-r border-border shrink-0 transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-muted hover:text-foreground transition-colors cursor-pointer"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder="Search..."
                className="h-8 w-60 rounded-lg border border-border bg-surface-raised pl-9 pr-12 text-sm placeholder:text-muted transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-white px-1.5 py-0.5 text-[10px] text-muted font-mono">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="relative rounded-lg p-2 text-muted hover:bg-surface-raised hover:text-foreground transition-colors cursor-pointer">
              <Bell className="h-[18px] w-[18px]" />
            </button>
            <div className="relative group">
              <button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surface-raised transition-colors cursor-pointer">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white shadow-xs">
                  {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
              </button>
              <div className="absolute right-0 top-full mt-1 hidden w-52 rounded-xl border border-border bg-white py-1 shadow-dropdown group-hover:block">
                <div className="px-4 py-2.5 border-b border-border-light">
                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted">{user?.email}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
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
