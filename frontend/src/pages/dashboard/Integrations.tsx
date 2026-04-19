import { Puzzle } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'

export default function Integrations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-muted mt-1">Connect with external services and marketplace APIs</p>
      </div>
      <EmptyState
        icon={<Puzzle className="h-12 w-12" />}
        title="Coming Soon"
        description="Platform integrations with Etsy, Amazon, Shopify, and other marketplace APIs will be available here."
      />
    </div>
  )
}
