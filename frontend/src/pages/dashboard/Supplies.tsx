import { Package } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'

export default function Supplies() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Supplies</h1>
        <p className="text-sm text-muted mt-1">Track packaging materials, hardware, and other consumables</p>
      </div>
      <EmptyState
        icon={<Package className="h-12 w-12" />}
        title="Coming Soon"
        description="Supply inventory tracking with reorder alerts and cost-per-unit calculations will be available here."
      />
    </div>
  )
}
