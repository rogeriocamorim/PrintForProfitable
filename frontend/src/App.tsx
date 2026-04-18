import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import WizardLayout from './pages/wizard/WizardLayout'
import Step1Farm from './pages/wizard/Step1Farm'
import Step2Equipment from './pages/wizard/Step2Equipment'
import Step3Sales from './pages/wizard/Step3Sales'
import Step4Model from './pages/wizard/Step4Model'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import Dashboard from './pages/dashboard/Dashboard'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminFarms from './pages/admin/AdminFarms'
import AdminSettings from './pages/admin/AdminSettings'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  return <Navigate to={user ? '/dashboard' : '/login'} replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <WizardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="farm" element={<Step1Farm />} />
            <Route path="equipment" element={<Step2Equipment />} />
            <Route path="sales" element={<Step3Sales />} />
            <Route path="model" element={<Step4Model />} />
          </Route>

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="*" element={<Dashboard />} />
          </Route>

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="farms" element={<AdminFarms />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
