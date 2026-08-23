import React from 'react'
import { useTranslation } from 'react-i18next'
import { FileCode } from 'lucide-react'

interface AgentYamlPreviewProps {
  yaml: string
  title?: string
  className?: string
}

export const AgentYamlPreview: React.FC<AgentYamlPreviewProps> = ({ yaml, title, className }) => {
  const { t } = useTranslation('agents')

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2">
        <FileCode className="h-3.5 w-3.5 text-(--accent)" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-(--text-muted)">
          {title || t('yamlFrontmatter')}
        </p>
      </div>
      <pre className="max-h-64 overflow-auto rounded-lg border border-(--border-main) bg-(--bg-card-subtle) p-3 font-mono text-[11px] leading-relaxed text-(--text-dim) wrap-break-word whitespace-pre-wrap">
        {yaml}
      </pre>
    </div>
  )
}
