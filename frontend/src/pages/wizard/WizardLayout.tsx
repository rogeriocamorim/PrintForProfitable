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
    <div className="min-h-screen bg-gray-50">
      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-dark">
                Print<span className="text-primary">For</span>Profitable
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              Step {currentStep} of {steps.length}
              <span className="font-medium text-gray-900">{steps[currentStep - 1]?.label}</span>
            </div>
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  )
}
