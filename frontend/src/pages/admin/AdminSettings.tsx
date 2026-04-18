import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { Save } from 'lucide-react'

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  defaultElectricityRate: 0.12,
  defaultLaborRate: 60,
  defaultProfitMargin: 50,
  registrationEnabled: true,
  maxFarmsPerUser: 5,
}

type SettingsKey = keyof typeof DEFAULT_SETTINGS

export default function AdminSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    api<Record<string, unknown>>('/admin/settings')
      .then((data) => {
        const merged = { ...DEFAULT_SETTINGS }
        for (const key of Object.keys(DEFAULT_SETTINGS) as SettingsKey[]) {
          if (data[key] !== undefined) {
            (merged as any)[key] = data[key]
          }
        }
        setSettings(merged)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const saveSetting = async (key: SettingsKey) => {
    setSaving(key)
    try {
      await api(`/admin/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value: settings[key] }),
      })
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Platform Settings</h2>
        <p className="text-slate-400 mt-1">Configure default values and feature flags.</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Toggle settings */}
        {(
          [
            { key: 'maintenanceMode' as const, label: 'Maintenance Mode', desc: 'When enabled, only admins can access the platform.' },
            { key: 'registrationEnabled' as const, label: 'Registration Enabled', desc: 'Allow new users to register.' },
          ] as const
        ).map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between rounded-xl bg-slate-800 border border-slate-700 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSettings({ ...settings, [key]: !settings[key] })
                }}
                className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
                  settings[key] ? 'bg-primary' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    settings[key] ? 'translate-x-5' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => saveSetting(key)}
                disabled={saving === key}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-primary cursor-pointer"
              >
                <Save className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Number settings */}
        {(
          [
            { key: 'defaultElectricityRate' as const, label: 'Default Electricity Rate ($/kWh)', step: 0.01 },
            { key: 'defaultLaborRate' as const, label: 'Default Labor Rate ($/hr)', step: 1 },
            { key: 'defaultProfitMargin' as const, label: 'Default Profit Margin (%)', step: 1 },
            { key: 'maxFarmsPerUser' as const, label: 'Max Farms Per User', step: 1 },
          ] as const
        ).map(({ key, label, step }) => (
          <div key={key} className="flex items-center justify-between rounded-xl bg-slate-800 border border-slate-700 px-5 py-4">
            <label className="text-sm font-medium text-white">{label}</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step={step}
                value={settings[key]}
                onChange={(e) => setSettings({ ...settings, [key]: parseFloat(e.target.value) || 0 })}
                className="h-9 w-28 rounded-lg border border-slate-600 bg-slate-700 px-3 text-sm text-white text-right focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={() => saveSetting(key)}
                disabled={saving === key}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-primary cursor-pointer"
              >
                <Save className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
