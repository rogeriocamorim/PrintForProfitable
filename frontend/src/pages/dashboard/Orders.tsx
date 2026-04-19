import { ShoppingCart } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'

export default function Orders() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-sm text-muted mt-1">Track and manage customer orders across all platforms</p>
      </div>
      <EmptyState
        icon={<ShoppingCart className="h-12 w-12" />}
        title="Coming Soon"
        description="Order management with status tracking, fulfillment workflow, and platform sync will be available here."
      />
    </div>
  )
}
