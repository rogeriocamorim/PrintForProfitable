import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Card, CardContent } from '../../components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Plus, Trash2, Pencil, Loader2, Store } from 'lucide-react'

interface SalesPlatform {
  id: string
  type: string
  shopName: string
  feesConfig: Record<string, unknown>
  enabled: boolean
  createdAt: string
}

const PLATFORM_TYPES = ['ETSY', 'AMAZON', 'SHOPIFY', 'TIKTOK', 'EBAY', 'SQUARE', 'DIRECT', 'CUSTOM']

const platformBadge: Record<string, 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  ETSY: 'primary', AMAZON: 'warning', SHOPIFY: 'success', TIKTOK: 'danger', EBAY: 'info', SQUARE: 'info', DIRECT: 'success', CUSTOM: 'default',
}

type Country = 'US' | 'CA' | 'UK' | 'EU' | 'DE' | 'FR' | 'ES' | 'IT' | 'NL' | 'BR' | 'MX' | 'AU' | 'NZ' | 'JP' | 'KR' | 'IN' | 'SG' | 'ZA'

const COUNTRIES: { value: Country; label: string; currency: string }[] = [
  { value: 'US', label: 'United States', currency: '$' },
  { value: 'CA', label: 'Canada', currency: 'C$' },
  { value: 'UK', label: 'United Kingdom', currency: '£' },
  { value: 'EU', label: 'Europe (General)', currency: '€' },
  { value: 'DE', label: 'Germany', currency: '€' },
  { value: 'FR', label: 'France', currency: '€' },
  { value: 'ES', label: 'Spain', currency: '€' },
  { value: 'IT', label: 'Italy', currency: '€' },
  { value: 'NL', label: 'Netherlands', currency: '€' },
  { value: 'BR', label: 'Brazil', currency: 'R$' },
  { value: 'MX', label: 'Mexico', currency: 'MX$' },
  { value: 'AU', label: 'Australia', currency: 'A$' },
  { value: 'NZ', label: 'New Zealand', currency: 'NZ$' },
  { value: 'JP', label: 'Japan', currency: '¥' },
  { value: 'KR', label: 'South Korea', currency: '₩' },
  { value: 'IN', label: 'India', currency: '₹' },
  { value: 'SG', label: 'Singapore', currency: 'S$' },
  { value: 'ZA', label: 'South Africa', currency: 'R' },
]

// Each fee component stored separately
interface FeeDefaults {
  transactionPct: string   // e.g. "6.5"
  processingPct: string    // e.g. "3"
  processingFlat: string   // e.g. "0.25"
  listingFee: string       // e.g. "0.20"
}

// Which fee fields are relevant per platform type
const PLATFORM_FEE_LABELS: Record<string, { transactionPct?: string; processingPct?: string; processingFlat?: string; listingFee?: string }> = {
  ETSY:    { transactionPct: 'Transaction Fee', processingPct: 'Payment Processing', processingFlat: 'Processing Flat Fee', listingFee: 'Listing Fee' },
  AMAZON:  { transactionPct: 'Referral Fee' },
  SHOPIFY: { processingPct: 'Payment Processing', processingFlat: 'Processing Flat Fee' },
  TIKTOK:  { transactionPct: 'Referral Fee', processingPct: 'Payment Processing', processingFlat: 'Processing Flat Fee' },
  EBAY:    { transactionPct: 'Final Value Fee', processingFlat: 'Per-Order Fee' },
  SQUARE:  { transactionPct: 'Credit Card Fee (2.5%)', processingFlat: 'Flat Fee' },
  DIRECT:  {},
  CUSTOM:  { transactionPct: 'Fee Percentage', processingFlat: 'Flat Fee per Sale' },
}

const PLATFORM_DEFAULTS: Record<string, Record<Country, FeeDefaults>> = {
  ETSY: {
    US: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.20' },
    CA: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.20' },
    UK: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.20', listingFee: '0.16' },
    EU: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.18' },
    DE: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.18' },
    FR: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.18' },
    ES: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.18' },
    IT: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.18' },
    NL: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.18' },
    BR: { transactionPct: '6.5', processingPct: '3', processingFlat: '1.25', listingFee: '1.00' },
    MX: { transactionPct: '6.5', processingPct: '3', processingFlat: '5.00', listingFee: '4.00' },
    AU: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.30' },
    NZ: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.25', listingFee: '0.30' },
    JP: { transactionPct: '6.5', processingPct: '3', processingFlat: '35', listingFee: '30' },
    KR: { transactionPct: '6.5', processingPct: '3', processingFlat: '350', listingFee: '300' },
    IN: { transactionPct: '6.5', processingPct: '3', processingFlat: '20', listingFee: '15' },
    SG: { transactionPct: '6.5', processingPct: '3', processingFlat: '0.35', listingFee: '0.25' },
    ZA: { transactionPct: '6.5', processingPct: '3', processingFlat: '4.50', listingFee: '3.50' },
  },
  AMAZON: {
    US: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    CA: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    UK: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    EU: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    DE: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    FR: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    ES: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    IT: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    NL: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    BR: { transactionPct: '16', processingPct: '0', processingFlat: '0', listingFee: '0' },
    MX: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    AU: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    NZ: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    JP: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    KR: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    IN: { transactionPct: '17', processingPct: '0', processingFlat: '0', listingFee: '0' },
    SG: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
    ZA: { transactionPct: '15', processingPct: '0', processingFlat: '0', listingFee: '0' },
  },
  SHOPIFY: {
    US: { transactionPct: '0', processingPct: '2.9', processingFlat: '0.30', listingFee: '0' },
    CA: { transactionPct: '0', processingPct: '2.9', processingFlat: '0.30', listingFee: '0' },
    UK: { transactionPct: '0', processingPct: '2.2', processingFlat: '0.20', listingFee: '0' },
    EU: { transactionPct: '0', processingPct: '2.2', processingFlat: '0.25', listingFee: '0' },
    DE: { transactionPct: '0', processingPct: '2.2', processingFlat: '0.25', listingFee: '0' },
    FR: { transactionPct: '0', processingPct: '2.2', processingFlat: '0.25', listingFee: '0' },
    ES: { transactionPct: '0', processingPct: '2.2', processingFlat: '0.25', listingFee: '0' },
    IT: { transactionPct: '0', processingPct: '2.2', processingFlat: '0.25', listingFee: '0' },
    NL: { transactionPct: '0', processingPct: '2.2', processingFlat: '0.25', listingFee: '0' },
    BR: { transactionPct: '0', processingPct: '3.5', processingFlat: '0', listingFee: '0' },
    MX: { transactionPct: '0', processingPct: '3.4', processingFlat: '0', listingFee: '0' },
    AU: { transactionPct: '0', processingPct: '2.9', processingFlat: '0.30', listingFee: '0' },
    NZ: { transactionPct: '0', processingPct: '2.9', processingFlat: '0.30', listingFee: '0' },
    JP: { transactionPct: '0', processingPct: '3.4', processingFlat: '0', listingFee: '0' },
    KR: { transactionPct: '0', processingPct: '3.3', processingFlat: '0', listingFee: '0' },
    IN: { transactionPct: '0', processingPct: '2.9', processingFlat: '0', listingFee: '0' },
    SG: { transactionPct: '0', processingPct: '3.4', processingFlat: '0.50', listingFee: '0' },
    ZA: { transactionPct: '0', processingPct: '2.9', processingFlat: '0', listingFee: '0' },
  },
  TIKTOK: {
    US: { transactionPct: '8', processingPct: '2.9', processingFlat: '0.30', listingFee: '0' },
    CA: { transactionPct: '8', processingPct: '2.9', processingFlat: '0.30', listingFee: '0' },
    UK: { transactionPct: '5', processingPct: '2.9', processingFlat: '0.20', listingFee: '0' },
    EU: { transactionPct: '5', processingPct: '2.9', processingFlat: '0.25', listingFee: '0' },
    DE: { transactionPct: '5', processingPct: '2.9', processingFlat: '0.25', listingFee: '0' },
    FR: { transactionPct: '5', processingPct: '2.9', processingFlat: '0.25', listingFee: '0' },
    ES: { transactionPct: '5', processingPct: '2.9', processingFlat: '0.25', listingFee: '0' },
    IT: { transactionPct: '5', processingPct: '2.9', processingFlat: '0.25', listingFee: '0' },
    NL: { transactionPct: '5', processingPct: '2.9', processingFlat: '0.25', listingFee: '0' },
    BR: { transactionPct: '5', processingPct: '2.9', processingFlat: '0', listingFee: '0' },
    MX: { transactionPct: '5', processingPct: '2.9', processingFlat: '0', listingFee: '0' },
    AU: { transactionPct: '8', processingPct: '2.9', processingFlat: '0.30', listingFee: '0' },
    NZ: { transactionPct: '8', processingPct: '2.9', processingFlat: '0.30', listingFee: '0' },
    JP: { transactionPct: '5', processingPct: '2.9', processingFlat: '0', listingFee: '0' },
    KR: { transactionPct: '5', processingPct: '2.9', processingFlat: '0', listingFee: '0' },
    IN: { transactionPct: '5', processingPct: '2.9', processingFlat: '0', listingFee: '0' },
    SG: { transactionPct: '5', processingPct: '2.9', processingFlat: '0', listingFee: '0' },
    ZA: { transactionPct: '5', processingPct: '2.9', processingFlat: '0', listingFee: '0' },
  },
  EBAY: {
    US: { transactionPct: '13.25', processingPct: '0', processingFlat: '0.30', listingFee: '0' },
    CA: { transactionPct: '13.25', processingPct: '0', processingFlat: '0.30', listingFee: '0' },
    UK: { transactionPct: '12.8', processingPct: '0', processingFlat: '0.25', listingFee: '0' },
    EU: { transactionPct: '11', processingPct: '0', processingFlat: '0.35', listingFee: '0' },
    DE: { transactionPct: '11', processingPct: '0', processingFlat: '0.35', listingFee: '0' },
    FR: { transactionPct: '11', processingPct: '0', processingFlat: '0.35', listingFee: '0' },
    ES: { transactionPct: '11', processingPct: '0', processingFlat: '0.35', listingFee: '0' },
    IT: { transactionPct: '11', processingPct: '0', processingFlat: '0.35', listingFee: '0' },
    NL: { transactionPct: '11', processingPct: '0', processingFlat: '0.35', listingFee: '0' },
    BR: { transactionPct: '16', processingPct: '0', processingFlat: '0', listingFee: '0' },
    MX: { transactionPct: '13.25', processingPct: '0', processingFlat: '0', listingFee: '0' },
    AU: { transactionPct: '13.2', processingPct: '0', processingFlat: '0.30', listingFee: '0' },
    NZ: { transactionPct: '13.2', processingPct: '0', processingFlat: '0.30', listingFee: '0' },
    JP: { transactionPct: '10', processingPct: '0', processingFlat: '0', listingFee: '0' },
    KR: { transactionPct: '12', processingPct: '0', processingFlat: '0', listingFee: '0' },
    IN: { transactionPct: '12', processingPct: '0', processingFlat: '0', listingFee: '0' },
    SG: { transactionPct: '13.25', processingPct: '0', processingFlat: '0.30', listingFee: '0' },
    ZA: { transactionPct: '13.25', processingPct: '0', processingFlat: '0', listingFee: '0' },
  },
  SQUARE: {
    US: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    CA: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    UK: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    EU: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    DE: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    FR: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    ES: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    IT: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    NL: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    BR: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    MX: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    AU: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    NZ: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    JP: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    KR: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    IN: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    SG: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
    ZA: { transactionPct: '2.5', processingPct: '0', processingFlat: '0', listingFee: '0' },
  },
  DIRECT: {
    US: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    CA: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    UK: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    EU: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    DE: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    FR: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    ES: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    IT: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    NL: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    BR: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    MX: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    AU: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    NZ: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    JP: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    KR: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    IN: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    SG: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    ZA: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
  },
  CUSTOM: {
    US: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    CA: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    UK: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    EU: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    DE: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    FR: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    ES: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    IT: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    NL: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    BR: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    MX: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    AU: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    NZ: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    JP: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    KR: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    IN: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    SG: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
    ZA: { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' },
  },
}

const EMPTY_FEES: FeeDefaults = { transactionPct: '0', processingPct: '0', processingFlat: '0', listingFee: '0' }

function computeTotals(fees: FeeDefaults) {
  const totalPct = (parseFloat(fees.transactionPct) || 0) + (parseFloat(fees.processingPct) || 0)
  const totalFlat = (parseFloat(fees.processingFlat) || 0) + (parseFloat(fees.listingFee) || 0)
  return { totalPct, totalFlat }
}

export default function Marketplaces() {
  const [platforms, setPlatforms] = useState<SalesPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const selectClasses = "flex h-9 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-xs transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SalesPlatform | null>(null)
  const [saving, setSaving] = useState(false)
  const [formBase, setFormBase] = useState({ type: 'ETSY', shopName: '', country: 'US' as Country })
  const [fees, setFees] = useState<FeeDefaults>({ ...PLATFORM_DEFAULTS['ETSY']['US'] })

  useEffect(() => {
    api<SalesPlatform[]>('/platforms').then(setPlatforms).finally(() => setLoading(false))
  }, [])

  function applyDefaults(type: string, country: Country) {
    const defaults = PLATFORM_DEFAULTS[type]?.[country] ?? EMPTY_FEES
    setFormBase((prev) => ({ ...prev, type, country }))
    setFees({ ...defaults })
  }

  function openAdd() {
    setEditing(null)
    setFormBase({ type: 'ETSY', shopName: '', country: 'US' })
    setFees({ ...PLATFORM_DEFAULTS['ETSY']['US'] })
    setShowModal(true)
  }

  function openEdit(p: SalesPlatform) {
    setEditing(p)
    const fc = (p.feesConfig || {}) as Record<string, string>
    setFormBase({
      type: p.type,
      shopName: p.shopName,
      country: (fc.country as Country) || 'US',
    })
    setFees({
      transactionPct: fc.transactionPct ?? '0',
      processingPct: fc.processingPct ?? '0',
      processingFlat: fc.processingFlat ?? '0',
      listingFee: fc.listingFee ?? '0',
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { totalPct, totalFlat } = computeTotals(fees)
      const body = JSON.stringify({
        type: formBase.type,
        shopName: formBase.shopName,
        feesConfig: {
          ...fees,
          country: formBase.country,
          // Backend uses these two for pricing calculation
          percentage: String(totalPct),
          flat: String(totalFlat),
        },
      })
      if (editing) {
        const updated = await api<SalesPlatform>(`/platforms/${editing.id}`, { method: 'PUT', body })
        setPlatforms(platforms.map((p) => p.id === updated.id ? updated : p))
      } else {
        const created = await api<SalesPlatform>('/platforms', { method: 'POST', body })
        setPlatforms([created, ...platforms])
      }
      setShowModal(false)
    } catch {
      // error
    } finally {
      setSaving(false)
    }
  }

  async function toggleEnabled(p: SalesPlatform) {
    try {
      const updated = await api<SalesPlatform>(`/platforms/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !p.enabled }),
      })
      setPlatforms(platforms.map((x) => x.id === updated.id ? updated : x))
    } catch {
      // error
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this platform?')) return
    try {
      await api(`/platforms/${id}`, { method: 'DELETE' })
      setPlatforms(platforms.filter((p) => p.id !== id))
    } catch {
      // error
    }
  }

  function formatFeeSummary(fc: Record<string, unknown>) {
    const parts: string[] = []
    const tp = parseFloat(String(fc.transactionPct ?? '0'))
    const pp = parseFloat(String(fc.processingPct ?? '0'))
    const pf = parseFloat(String(fc.processingFlat ?? '0'))
    const lf = parseFloat(String(fc.listingFee ?? '0'))
    if (tp > 0) parts.push(`${tp}%`)
    if (pp > 0) parts.push(`${pp}%`)
    if (pf > 0) parts.push(`${pf} flat`)
    if (lf > 0) parts.push(`${lf} listing`)
    return parts.length > 0 ? parts.join(' + ') : '0%'
  }

  const currency = COUNTRIES.find((c) => c.value === formBase.country)?.currency ?? '$'
  const labels = PLATFORM_FEE_LABELS[formBase.type] ?? PLATFORM_FEE_LABELS['CUSTOM']
  const { totalPct, totalFlat } = computeTotals(fees)

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplaces</h1>
          <p className="text-sm text-muted mt-1">{platforms.length} platform{platforms.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Platform</Button>
      </div>

      {platforms.length === 0 ? (
        <Card><CardContent>
          <EmptyState
            icon={<Store className="h-12 w-12" />}
            title="No marketplaces yet"
            description="Add your sales platforms to calculate platform-specific pricing"
            action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Platform</Button>}
          />
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Platform</TableHead>
                <TableHead>Shop Name</TableHead>
                <TableHead>Fees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {platforms.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Badge variant={platformBadge[p.type] ?? 'default'}>{p.type}</Badge></TableCell>
                  <TableCell className="font-medium text-foreground">{p.shopName}</TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">{formatFeeSummary(p.feesConfig)}</span>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => toggleEnabled(p)} className="cursor-pointer">
                      <Badge variant={p.enabled ? 'success' : 'default'}>{p.enabled ? 'Active' : 'Disabled'}</Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="rounded p-1 text-muted hover:bg-surface-raised hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(p.id)} className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Platform' : 'Add Platform'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Platform Type</label>
            <select
              className={selectClasses}
              value={formBase.type}
              onChange={(e) => applyDefaults(e.target.value, formBase.country)}
            >
              {PLATFORM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Input label="Shop Name" value={formBase.shopName} onChange={(e) => setFormBase({ ...formBase, shopName: e.target.value })} required placeholder="e.g. My Etsy Shop" />

          {/* Country / Region */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Country / Region</label>
            <select
              className={selectClasses}
              value={formBase.country}
              onChange={(e) => applyDefaults(formBase.type, e.target.value as Country)}
            >
              {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Fee fields — each component separate */}
          <div className="rounded-lg border border-border bg-surface-raised p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Platform Fees</p>
              {formBase.type !== 'CUSTOM' && formBase.type !== 'DIRECT' && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => applyDefaults(formBase.type, formBase.country)}
                >
                  Reset to defaults
                </button>
              )}
            </div>

            <div className="space-y-3">
              {labels.transactionPct && (
                <Input
                  label={labels.transactionPct}
                  type="number"
                  step="0.01"
                  min="0"
                  suffix="%"
                  value={fees.transactionPct}
                  onChange={(e) => setFees({ ...fees, transactionPct: e.target.value })}
                />
              )}
              {labels.processingPct && (
                <Input
                  label={labels.processingPct}
                  type="number"
                  step="0.01"
                  min="0"
                  suffix="%"
                  value={fees.processingPct}
                  onChange={(e) => setFees({ ...fees, processingPct: e.target.value })}
                />
              )}
              {labels.processingFlat && (
                <Input
                  label={labels.processingFlat}
                  type="number"
                  step="0.01"
                  min="0"
                  prefix={currency}
                  value={fees.processingFlat}
                  onChange={(e) => setFees({ ...fees, processingFlat: e.target.value })}
                />
              )}
              {labels.listingFee && (
                <Input
                  label={labels.listingFee}
                  type="number"
                  step="0.01"
                  min="0"
                  prefix={currency}
                  value={fees.listingFee}
                  onChange={(e) => setFees({ ...fees, listingFee: e.target.value })}
                />
              )}
            </div>

            {/* Totals summary */}
            <div className="border-t border-border pt-2 flex items-center justify-between text-xs text-muted">
              <span>Total effective fees</span>
              <span className="font-medium text-foreground">
                {totalPct > 0 ? `${totalPct}%` : ''}
                {totalPct > 0 && totalFlat > 0 ? ' + ' : ''}
                {totalFlat > 0 ? `${currency}${totalFlat.toFixed(2)}` : ''}
                {totalPct === 0 && totalFlat === 0 ? '0%' : ''}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Save' : 'Add'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
