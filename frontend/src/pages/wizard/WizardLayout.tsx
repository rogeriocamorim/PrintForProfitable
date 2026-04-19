import { Outlet, useLocation } from 'react-router-dom'

const steps = [
  { path: '/setup/farm', label: 'Farm Setup', step: 1 },
  { path: '/setup/equipment', label: 'Equipment', step: 2 },
  { path: '/setup/sales', label: 'Sales & Shipping', step: 3 },
  { path: '/setup/model', label: 'First Model', step: 4 },
]

export default function WizardLayout() {
  const location = useLocation()
  const currentStep = steps.findIndex((s) => location.pathname.startsWith(s.path)) + 1 || 1
  const progress = (currentStep / steps.length) * 100

  return (
    <div className="min-h-screen bg-surface-raised">
      {/* Progress bar */}
      <div className="h-1 bg-border-light">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-dark">
              Print<span className="text-primary">For</span>Profitable
            </span>
            <div className="flex items-center gap-2 text-sm text-muted">
              Step {currentStep} of {steps.length}
              <span className="font-medium text-foreground">{steps[currentStep - 1]?.label}</span>
            </div>
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  )
}
