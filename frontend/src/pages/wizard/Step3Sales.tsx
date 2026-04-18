import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent } from '../../components/ui/Card'
import { Store, ShoppingBag, ShoppingCart, Video, Tag, Settings } from 'lucide-react'
import { api } from '../../lib/api'

interface ShippingProfile {
  name: string
  customerPays: string
  postageCost: string
  deliveryMin: string
  deliveryMax: string
}

const PLATFORMS = [
  {
    id: 'etsy',
    name: 'Etsy',
    icon: Store,
    fees: 'Transaction 6.5% + Payment Processing 3% + $0.25 + Listing $0.20/unit',
  },
  {
    id: 'amazon',
    name: 'Amazon',
    icon: ShoppingBag,
    fees: 'Referral 15%',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    icon: ShoppingCart,
    fees: 'Payment Processing 2.9% + $0.30',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Video,
    fees: 'Referral 8% + Payment Processing 2.9% + $0.30',
  },
  {
    id: 'ebay',
    name: 'eBay',
    icon: Tag,
    fees: 'Final Value 13.25% + $0.30',
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: Settings,
    fees: 'No preset fees — configure your own',
  },
]

export default function Step3Sales() {
  const navigate = useNavigate()
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [shopName, setShopName] = useState('')
  const [shipping, setShipping] = useState<ShippingProfile>({
    name: '',
    customerPays: '',
    postageCost: '',
    deliveryMin: '',
    deliveryMax: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const platform = PLATFORMS.find((p) => p.id === selectedPlatform)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/wizard/step3', {
        method: 'PUT',
        body: JSON.stringify({
          salesPlatforms: selectedPlatform
            ? [
                {
                  type: selectedPlatform.toUpperCase(),
                  shopName,
                  feesConfig: { description: platform?.fees },
                  enabled: true,
                },
              ]
            : [],
          shippingProfiles: shipping.name
            ? [
                {
                  name: shipping.name,
                  customerPays: parseFloat(shipping.customerPays) || 5.99,
                  postageCost: parseFloat(shipping.postageCost) || 5.0,
                  deliveryMinDays: parseInt(shipping.deliveryMin) || 3,
                  deliveryMaxDays: parseInt(shipping.deliveryMax) || 5,
                },
              ]
            : [],
        }),
      })
      navigate('/setup/model')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sales settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="flex flex-col justify-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Sales & Shipping</h1>
          <p className="text-muted text-lg">
            Connect your sales platform so we can factor in marketplace fees and shipping costs into your pricing.
          </p>
        </div>

        <div className="space-y-6">
          {/* Platform selector */}
          <Card>
            <CardContent className="py-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Sales Platform</h3>
              <div className="grid grid-cols-3 gap-3">
                {PLATFORMS.map((p) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlatform(p.id)}
                      className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-colors cursor-pointer ${
                        selectedPlatform === p.id
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                      {p.name}
                    </button>
                  )
                })}
              </div>

              {platform && (
                <div className="mt-4 space-y-4">
                  <Input
                    label="Shop Name"
                    placeholder="My 3D Print Shop"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                  />
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                    <p className="text-sm font-medium text-blue-900">Platform Fees</p>
                    <p className="text-sm text-blue-700 mt-1">{platform.fees}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping */}
          <Card>
            <CardContent className="py-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Shipping Profile</h3>
              <div className="space-y-4">
                <Input
                  label="Profile Name"
                  placeholder="Standard Shipping"
                  value={shipping.name}
                  onChange={(e) => setShipping({ ...shipping, name: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Customer Pays"
                    type="number"
                    step="0.01"
                    prefix="$"
                    placeholder="5.99"
                    value={shipping.customerPays}
                    onChange={(e) => setShipping({ ...shipping, customerPays: e.target.value })}
                  />
                  <Input
                    label="Your Postage Cost"
                    type="number"
                    step="0.01"
                    prefix="$"
                    placeholder="4.50"
                    value={shipping.postageCost}
                    onChange={(e) => setShipping({ ...shipping, postageCost: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Estimate</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="3"
                      value={shipping.deliveryMin}
                      onChange={(e) => setShipping({ ...shipping, deliveryMin: e.target.value })}
                    />
                    <span className="text-sm text-muted">to</span>
                    <Input
                      type="number"
                      placeholder="7"
                      value={shipping.deliveryMax}
                      onChange={(e) => setShipping({ ...shipping, deliveryMax: e.target.value })}
                    />
                    <span className="text-sm text-muted whitespace-nowrap">days</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="mt-4 text-sm text-muted hover:text-gray-700 cursor-pointer"
              >
                Selling in person only?
              </button>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
            )}
            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? 'Saving...' : 'Continue'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
