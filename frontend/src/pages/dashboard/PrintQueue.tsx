import { ListOrdered } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'

export default function PrintQueue() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Print Queue</h1>
        <p className="text-sm text-muted mt-1">Manage your print jobs and printer assignments</p>
      </div>
      <EmptyState
        icon={<ListOrdered className="h-12 w-12" />}
        title="Coming Soon"
        description="Print queue with job scheduling, printer assignment, and progress tracking will be available here."
      />
    </div>
  )
}
