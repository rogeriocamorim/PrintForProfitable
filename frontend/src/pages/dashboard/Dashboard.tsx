import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Welcome to PrintForProfitable!
          </h2>
          <p className="max-w-md text-muted mb-6">
            Complete your setup to start tracking your print farm metrics. Add your printers, filaments, and first model to see cost breakdowns and profit analysis.
          </p>
          <Button onClick={() => navigate('/setup/farm')}>Complete Setup</Button>
        </CardContent>
      </Card>
    </div>
  )
}
