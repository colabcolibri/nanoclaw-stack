import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, ExternalLink } from 'lucide-react'
import type { IntegrationId } from '@/components/mcps/integration-definitions'
import { maskSecret } from '@/components/mcps/integration-definitions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface IntegrationConfigSheetProps {
  activeSheet: IntegrationId | null
  onClose: () => void
  googlePolicy: { mode: string; emailSender: string }
  onGooglePolicyChange: (patch: Partial<{ mode: string; emailSender: string }>) => void
  onSaveGooglePolicy: () => void
  notionApiKey: string
  notionDbId: string
  onNotionApiKeyChange: (v: string) => void
  onNotionDbIdChange: (v: string) => void
  onSaveNotion: () => void
  notionConnected: boolean
  notionMaskedKey?: string
  notionBotName?: string
  yampiAlias: string
  yampiToken: string
  yampiSecret: string
  onYampiAliasChange: (v: string) => void
  onYampiTokenChange: (v: string) => void
  onYampiSecretChange: (v: string) => void
  onSaveYampi: () => void
  yampiConnected: boolean
  yampiMaskedToken?: string
  yampiMaskedSecret?: string
  macConfig: { apiKey: string; endpoint: string; group: string }
  shippingConfig: { originCep: string; priceMarginPct: number; leadTimeDaysBuffer: number }
  onShippingChange: (patch: Partial<{ originCep: string; priceMarginPct: number; leadTimeDaysBuffer: number }>) => void
  onSaveShipping: () => void
  onConnectGoogle: () => void
  googleConnected: boolean
}

export const IntegrationConfigSheet: React.FC<IntegrationConfigSheetProps> = ({
  activeSheet,
  onClose,
  googlePolicy,
  onGooglePolicyChange,
  onSaveGooglePolicy,
  notionApiKey,
  notionDbId,
  onNotionApiKeyChange,
  onNotionDbIdChange,
  onSaveNotion,
  notionConnected,
  notionMaskedKey,
  notionBotName,
  yampiAlias,
  yampiToken,
  yampiSecret,
  onYampiAliasChange,
  onYampiTokenChange,
  onYampiSecretChange,
  onSaveYampi,
  yampiConnected,
  yampiMaskedToken,
  yampiMaskedSecret,
  macConfig,
  shippingConfig,
  onShippingChange,
  onSaveShipping,
  onConnectGoogle,
  googleConnected,
}) => {
  const { t } = useTranslation('mcps')
  const [copiedEndpoint, setCopiedEndpoint] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  const sheetTitle = activeSheet ? t(`sheet.${activeSheet}.title`) : ''
  const sheetDescription = activeSheet ? t(`sheet.${activeSheet}.description`) : ''

  const copyText = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      setter(true)
      setTimeout(() => setter(false), 2000)
    } catch {}
  }

  return (
    <Sheet open={Boolean(activeSheet)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-full max-w-lg flex-col gap-0 overflow-hidden border-l p-0 backdrop-blur-xl sm:max-w-lg"
      >
        <div className="flex h-full min-w-0 flex-col">
          <SheetHeader className="shrink-0 space-y-0 border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)]/50 px-6 pb-5 pt-6">
            <div className="pr-8">
              <SheetTitle className="text-lg leading-snug">{sheetTitle}</SheetTitle>
              <SheetDescription className="mt-1 text-xs leading-relaxed">
                {sheetDescription}
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
            {activeSheet === 'google' && (
              <div className="space-y-5">
                {!googleConnected && (
                  <Button type="button" className="w-full gap-2" onClick={onConnectGoogle}>
                    <ExternalLink className="h-4 w-4" />
                    {t('actions.connectGoogle')}
                  </Button>
                )}
                <div className="space-y-2">
                  <Label>{t('google.policyMode')}</Label>
                  <Select
                    value={googlePolicy.mode}
                    onValueChange={(mode) => onGooglePolicyChange({ mode })}
                  >
                    <SelectTrigger className="h-auto min-h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft_approval">{t('google.policyDraft')}</SelectItem>
                      <SelectItem value="auto_safe">{t('google.policyAuto')}</SelectItem>
                      <SelectItem value="notify_only">{t('google.policyNotify')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('google.emailSender')}</Label>
                  <Input
                    value={googlePolicy.emailSender}
                    onChange={(e) => onGooglePolicyChange({ emailSender: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--border-main)] pt-4">
                  <Button type="button" variant="outline" size="sm" onClick={onClose}>
                    {t('actions.cancel')}
                  </Button>
                  <Button type="button" size="sm" onClick={onSaveGooglePolicy}>
                    {t('actions.save')}
                  </Button>
                </div>
              </div>
            )}

            {activeSheet === 'notion' && (
              <div className="space-y-5">
                {notionConnected && notionBotName && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                    {t('status.connectedAs', { name: notionBotName })}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t('notion.apiKey')}</Label>
                  {notionConnected && notionMaskedKey && (
                    <MaskedHint label={t('masked.current')} value={notionMaskedKey} />
                  )}
                  <Input
                    type="password"
                    value={notionApiKey}
                    onChange={(e) => onNotionApiKeyChange(e.target.value)}
                    placeholder={notionConnected ? t('masked.newKeyOptional') : 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('notion.dbId')}</Label>
                  <Input
                    value={notionDbId}
                    onChange={(e) => onNotionDbIdChange(e.target.value)}
                    placeholder="1a2b3c4d5e6f..."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--border-main)] pt-4">
                  <Button type="button" variant="outline" size="sm" onClick={onClose}>
                    {t('actions.cancel')}
                  </Button>
                  <Button type="button" size="sm" onClick={onSaveNotion}>
                    {t('actions.testAndSave')}
                  </Button>
                </div>
              </div>
            )}

            {activeSheet === 'yampi' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>{t('yampi.alias')}</Label>
                  <Input
                    value={yampiAlias}
                    onChange={(e) => onYampiAliasChange(e.target.value)}
                    placeholder="colibri"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('yampi.token')}</Label>
                  {yampiConnected && yampiMaskedToken && (
                    <MaskedHint label={t('masked.current')} value={yampiMaskedToken} />
                  )}
                  <Input
                    type="password"
                    value={yampiToken}
                    onChange={(e) => onYampiTokenChange(e.target.value)}
                    placeholder={yampiConnected ? t('masked.keepCurrent') : undefined}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('yampi.secret')}</Label>
                  {yampiConnected && yampiMaskedSecret && (
                    <MaskedHint label={t('masked.current')} value={yampiMaskedSecret} />
                  )}
                  <Input
                    type="password"
                    value={yampiSecret}
                    onChange={(e) => onYampiSecretChange(e.target.value)}
                    placeholder={yampiConnected ? t('masked.keepCurrent') : undefined}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--border-main)] pt-4">
                  <Button type="button" variant="outline" size="sm" onClick={onClose}>
                    {t('actions.cancel')}
                  </Button>
                  <Button type="button" size="sm" onClick={onSaveYampi}>
                    {t('actions.testAndSave')}
                  </Button>
                </div>
              </div>
            )}

            {activeSheet === 'mac' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>{t('mac.endpoint')}</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={macConfig.endpoint} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 px-3"
                      onClick={() => copyText(macConfig.endpoint, setCopiedEndpoint)}
                    >
                      {copiedEndpoint ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('mac.apiKey')}</Label>
                  {macConfig.apiKey ? (
                    <MaskedHint label={t('masked.current')} value={maskSecret(macConfig.apiKey)} />
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">{t('mac.noKey')}</p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={macConfig.apiKey ? maskSecret(macConfig.apiKey) : '—'}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 px-3"
                      disabled={!macConfig.apiKey}
                      onClick={() => copyText(macConfig.apiKey, setCopiedKey)}
                    >
                      {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] p-4 text-xs leading-relaxed text-[var(--text-muted)]">
                  <p className="mb-2 font-semibold text-[var(--text-main)]">{t('mac.howToTitle')}</p>
                  <ol className="list-decimal space-y-1.5 pl-4">
                    <li>{t('mac.step1')}</li>
                    <li>{t('mac.step2')}</li>
                    <li>{t('mac.step3')}</li>
                    <li>{t('mac.step4')}</li>
                  </ol>
                </div>
              </div>
            )}

            {activeSheet === 'shipping' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>{t('shipping.originCep')}</Label>
                  <Input
                    value={shippingConfig.originCep}
                    onChange={(e) => onShippingChange({ originCep: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('shipping.margin')}</Label>
                    <Input
                      type="number"
                      value={shippingConfig.priceMarginPct}
                      onChange={(e) => onShippingChange({ priceMarginPct: Number(e.target.value) })}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('shipping.buffer')}</Label>
                    <Input
                      type="number"
                      value={shippingConfig.leadTimeDaysBuffer}
                      onChange={(e) => onShippingChange({ leadTimeDaysBuffer: Number(e.target.value) })}
                      className="text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--border-main)] pt-4">
                  <Button type="button" variant="outline" size="sm" onClick={onClose}>
                    {t('actions.cancel')}
                  </Button>
                  <Button type="button" size="sm" onClick={onSaveShipping}>
                    {t('actions.save')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MaskedHint({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[11px] text-[var(--text-muted)]">
      <span className="font-semibold text-[var(--text-dim)]">{label}: </span>
      <span className="font-mono text-[var(--text-main)]">{value}</span>
    </p>
  )
}
