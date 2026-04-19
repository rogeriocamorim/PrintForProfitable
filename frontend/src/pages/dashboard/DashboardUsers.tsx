import { Users } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'

export default function DashboardUsers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-sm text-muted mt-1">Manage team members and their access to your farm</p>
      </div>
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title="Coming Soon"
        description="Team management with role assignments, invitations, and activity logs will be available here."
      />
    </div>
  )
}
