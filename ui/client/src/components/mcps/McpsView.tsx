import React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, ExternalLink, Plug, RefreshCw, Server } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CustomMcpPanel } from '@/components/mcps/CustomMcpPanel'
import { IntegrationCard } from '@/components/mcps/IntegrationCard'
import { IntegrationConfigSheet } from '@/components/mcps/IntegrationConfigSheet'
import { ICON_TONE_CLASSES, INTEGRATIONS, type IntegrationId } from '@/components/mcps/integration-definitions'
import { useIntegrations } from '@/components/mcps/useIntegrations'

type StatusVariant = 'success' | 'secondary' | 'destructive'

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="min-w-0 rounded-xl border border-(--border-main) bg-(--bg-card) p-4">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-(--text-dim)">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="truncate">{label}</span>
      </div>
      <p className="font-mono text-lg font-semibold text-(--text-main)">{value}</p>
    </div>
  )
}

export const McpsView: React.FC = () => {
  const { t } = useTranslation('mcps')
  const {
    googleStatus,
    googlePolicy,
    setGooglePolicy,
    notionStatus,
    notionApiKey,
    setNotionApiKey,
    notionDbId,
    setNotionDbId,
    yampiStatus,
    yampiAlias,
    setYampiAlias,
    yampiToken,
    setYampiToken,
    yampiSecret,
    setYampiSecret,
    macConfig,
    shippingConfig,
    setShippingConfig,
    customMcpsJson,
    setCustomMcpsJson,
    activeSheet,
    setActiveSheet,
    toastMessage,
    isLoading,
    mcpServerRows,
    connectedCount,
    loadAllIntegrations,
    handleConnectGoogle,
    handleDisconnectGoogle,
    handleSaveGooglePolicy,
    handleSaveNotion,
    handleDisconnectNotion,
    handleSaveYampi,
    handleDisconnectYampi,
    handleSaveShipping,
    handleSaveCustomMcps,
  } = useIntegrations()

  const oauthConnected =
    Number(googleStatus.connected) + Number(notionStatus.connected) + Number(yampiStatus.connected)

  const getCardProps = (id: IntegrationId) => {
    switch (id) {
      case 'google':
        return {
          statusLabel: googleStatus.connected
            ? t('status.connectedEmail', { email: googleStatus.email || '—' })
            : t('status.disconnected'),
          statusVariant: (googleStatus.connected ? 'success' : 'destructive') as StatusVariant,
          onConfigure: googleStatus.connected
            ? () => setActiveSheet('google')
            : undefined,
          configureLabel: googleStatus.connected ? t('google.policyButton') : undefined,
          primaryAction: !googleStatus.connected
            ? { label: t('actions.connectGoogle'), onClick: handleConnectGoogle, variant: 'default' as const }
            : undefined,
          secondaryAction: googleStatus.connected
            ? { label: t('actions.disconnect'), onClick: handleDisconnectGoogle, variant: 'destructive' as const }
            : undefined,
        }
      case 'notion':
        return {
          statusLabel: notionStatus.connected
            ? notionStatus.botName
              ? t('status.connectedAs', { name: notionStatus.botName })
              : t('status.connected')
            : t('status.disconnected'),
          statusVariant: (notionStatus.connected ? 'success' : 'secondary') as StatusVariant,
          onConfigure: () => setActiveSheet('notion'),
          configureLabel: t('actions.configure'),
          secondaryAction: notionStatus.connected
            ? { label: t('actions.disconnect'), onClick: handleDisconnectNotion, variant: 'destructive' as const }
            : undefined,
        }
      case 'yampi':
        return {
          statusLabel: yampiStatus.connected
            ? t('status.connectedAlias', { alias: yampiStatus.alias || 'Loja' })
            : t('status.disconnected'),
          statusVariant: (yampiStatus.connected ? 'success' : 'secondary') as StatusVariant,
          onConfigure: () => setActiveSheet('yampi'),
          configureLabel: t('actions.configure'),
          secondaryAction: yampiStatus.connected
            ? { label: t('actions.disconnect'), onClick: handleDisconnectYampi, variant: 'destructive' as const }
            : undefined,
        }
      case 'mac':
        return {
          statusLabel: t('status.ready'),
          statusVariant: 'success' as StatusVariant,
          onConfigure: () => setActiveSheet('mac'),
          configureLabel: t('actions.configure'),
        }
      case 'shipping':
        return {
          statusLabel: t('status.activeCep', { cep: shippingConfig.originCep }),
          statusVariant: 'success' as StatusVariant,
          onConfigure: () => setActiveSheet('shipping'),
          configureLabel: t('actions.configure'),
        }
      default:
        return {
          statusLabel: t('status.disconnected'),
          statusVariant: 'secondary' as StatusVariant,
        }
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
      {toastMessage && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3.5 text-xs font-semibold animate-in fade-in ${
            toastMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-900 dark:text-emerald-300'
              : 'border-red-500/30 bg-red-500/15 text-red-900 dark:text-red-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <PageHeader
        view="mcps"
        subtitle={t('subtitle')}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllIntegrations}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{t('refresh')}</span>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-22 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard label={t('statsConnected')} value={`${connectedCount}/${INTEGRATIONS.length}`} icon={Plug} />
            <StatCard label={t('statsOAuth')} value={oauthConnected} icon={ExternalLink} />
            <StatCard label={t('statsMcpServers')} value={mcpServerRows.length} icon={Server} />
            <StatCard label={t('statsTotal')} value={INTEGRATIONS.length} icon={Plug} />
          </>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-(--text-main)">{t('sectionOfficial')}</h2>
          <p className="mt-0.5 text-xs text-(--text-muted)">{t('sectionOfficialHint')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-50 rounded-xl" />
              ))
            : INTEGRATIONS.map((integration) => {
                const cardProps = getCardProps(integration.id)
                return (
                  <IntegrationCard
                    key={integration.id}
                    icon={integration.icon}
                    iconClassName={ICON_TONE_CLASSES[integration.iconTone]}
                    title={t(integration.titleKey)}
                    description={t(integration.descriptionKey)}
                    statusLabel={cardProps.statusLabel}
                    statusVariant={cardProps.statusVariant}
                    onConfigure={cardProps.onConfigure}
                    configureLabel={cardProps.configureLabel}
                    primaryAction={cardProps.primaryAction}
                    secondaryAction={cardProps.secondaryAction}
                  />
                )
              })}
        </div>
      </div>

      <CustomMcpPanel
        customMcpsJson={customMcpsJson}
        onChange={setCustomMcpsJson}
        onSave={handleSaveCustomMcps}
        serverRows={mcpServerRows}
      />

      <IntegrationConfigSheet
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        googlePolicy={googlePolicy}
        onGooglePolicyChange={(patch) => setGooglePolicy((prev) => ({ ...prev, ...patch }))}
        onSaveGooglePolicy={handleSaveGooglePolicy}
        notionApiKey={notionApiKey}
        notionDbId={notionDbId}
        onNotionApiKeyChange={setNotionApiKey}
        onNotionDbIdChange={setNotionDbId}
        onSaveNotion={handleSaveNotion}
        notionConnected={notionStatus.connected}
        notionMaskedKey={notionStatus.maskedKey}
        notionBotName={notionStatus.botName}
        yampiAlias={yampiAlias}
        yampiToken={yampiToken}
        yampiSecret={yampiSecret}
        onYampiAliasChange={setYampiAlias}
        onYampiTokenChange={setYampiToken}
        onYampiSecretChange={setYampiSecret}
        onSaveYampi={handleSaveYampi}
        yampiConnected={yampiStatus.connected}
        yampiMaskedToken={yampiStatus.maskedUserToken}
        yampiMaskedSecret={yampiStatus.maskedUserSecret}
        macConfig={macConfig}
        shippingConfig={shippingConfig}
        onShippingChange={(patch) => setShippingConfig((prev) => ({ ...prev, ...patch }))}
        onSaveShipping={handleSaveShipping}
        onConnectGoogle={handleConnectGoogle}
        googleConnected={googleStatus.connected}
      />
    </div>
  )
}
