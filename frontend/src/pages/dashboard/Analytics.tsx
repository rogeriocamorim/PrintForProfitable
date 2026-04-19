import { BarChart3 } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Analytics</h1>
        <p className="text-sm text-muted mt-1">Track sales performance, revenue trends, and product insights</p>
      </div>
      <EmptyState
        icon={<BarChart3 className="h-12 w-12" />}
        title="Coming Soon"
        description="Product analytics with revenue charts, best sellers, and margin analysis will be available here."
      />
    </div>
  )
}
