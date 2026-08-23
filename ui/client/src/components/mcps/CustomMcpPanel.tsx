import React from 'react'
import { useTranslation } from 'react-i18next'
import { Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface CustomMcpPanelProps {
  customMcpsJson: string
  onChange: (value: string) => void
  onSave: () => void
  serverRows: { name: string; transport: string; endpoint: string }[]
}

export const CustomMcpPanel: React.FC<CustomMcpPanelProps> = ({
  customMcpsJson,
  onChange,
  onSave,
  serverRows,
}) => {
  const { t } = useTranslation('mcps')

  return (
    <section className="min-w-0 rounded-xl border border-(--border-main) bg-(--bg-card)">
      <div className="border-b border-(--border-main) px-5 py-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-(--accent)" />
          <h2 className="text-sm font-semibold text-(--text-main)">{t('custom.title')}</h2>
        </div>
        <p className="mt-1 text-xs text-(--text-muted)">{t('custom.description')}</p>
      </div>

      <div className="space-y-4 p-5">
        {serverRows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-(--border-main)">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('custom.colServer')}</TableHead>
                  <TableHead>{t('custom.colTransport')}</TableHead>
                  <TableHead>{t('custom.colEndpoint')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serverRows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-mono text-xs font-semibold">{row.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {row.transport}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs font-mono text-[11px] text-(--text-muted) break-all">
                      {row.endpoint}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <textarea
          className="min-h-45 w-full resize-y rounded-xl border border-(--border-main) bg-(--terminal-bg) p-4 font-mono text-xs leading-relaxed text-(--terminal-text) outline-none focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20"
          value={customMcpsJson}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={onSave} className="text-xs font-semibold">
            {t('custom.save')}
          </Button>
        </div>
      </div>
    </section>
  )
}
