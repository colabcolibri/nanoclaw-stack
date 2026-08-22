import {
  Calendar,
  FileText,
  ShoppingBag,
  Laptop,
  Truck,
  type LucideIcon,
} from 'lucide-react'

export type IntegrationId = 'google' | 'notion' | 'yampi' | 'mac' | 'shipping'

export interface IntegrationDefinition {
  id: IntegrationId
  icon: LucideIcon
  iconTone: string
  titleKey: string
  descriptionKey: string
  alwaysActive?: boolean
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: 'google',
    icon: Calendar,
    iconTone: 'sky',
    titleKey: 'googleTitle',
    descriptionKey: 'googleDescription',
  },
  {
    id: 'notion',
    icon: FileText,
    iconTone: 'purple',
    titleKey: 'notionTitle',
    descriptionKey: 'notionDescription',
  },
  {
    id: 'yampi',
    icon: ShoppingBag,
    iconTone: 'amber',
    titleKey: 'yampiTitle',
    descriptionKey: 'yampiDescription',
  },
  {
    id: 'mac',
    icon: Laptop,
    iconTone: 'slate',
    titleKey: 'macTitle',
    descriptionKey: 'macDescription',
    alwaysActive: true,
  },
  {
    id: 'shipping',
    icon: Truck,
    iconTone: 'orange',
    titleKey: 'shippingTitle',
    descriptionKey: 'shippingDescription',
    alwaysActive: true,
  },
]

export const ICON_TONE_CLASSES: Record<string, string> = {
  sky: 'border-sky-300/60 bg-sky-500/10 text-sky-600 dark:border-sky-500/40 dark:text-sky-300',
  purple: 'border-purple-300/60 bg-purple-500/10 text-purple-600 dark:border-purple-500/40 dark:text-purple-300',
  amber: 'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:text-amber-300',
  slate: 'border-slate-300/60 bg-slate-500/10 text-slate-700 dark:border-slate-600/40 dark:text-slate-200',
  orange: 'border-orange-300/60 bg-orange-500/10 text-orange-700 dark:border-orange-500/40 dark:text-orange-300',
}

export function maskSecret(value: string): string {
  if (!value) return ''
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}
