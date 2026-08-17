import React from 'react'
import { X, FileText, Code2, Folder, Copy, Check, Sparkles, CheckCircle2 } from 'lucide-react'
import { type SkillItem } from '@/api/client'
import { parseMarkdown } from '@/lib/markdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface SkillDetailsDrawerProps {
  isOpen: boolean
  onClose: () => void
  skill: SkillItem | null
}

export const SkillDetailsDrawer: React.FC<SkillDetailsDrawerProps> = ({
  isOpen,
  onClose,
  skill,
}) => {
  const [copiedScript, setCopiedScript] = React.useState<string | null>(null)

  if (!isOpen || !skill) return null

  const handleCopyCode = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedScript(id)
      setTimeout(() => setCopiedScript(null), 2000)
    } catch {}
  }

  const skillMdRendered = parseMarkdown(skill.skillMdContent || 'Sem conteúdo SKILL.md definido.')

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-[var(--bg-card)] border-l border-[var(--border-main)] shadow-2xl p-6 flex flex-col z-10 overflow-y-auto animate-in slide-in-from-right duration-200 text-[var(--text-main)]">
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-[var(--border-main)] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[var(--text-main)]">{skill.name}</h3>
                <Badge variant={skill.enabled ? 'success' : 'secondary'}>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{skill.enabled ? 'Ativa' : 'Inativa'}</span>
                </Badge>
              </div>
              <p className="text-xs font-mono text-[var(--text-dim)] mt-0.5">
                nanoclaw/container/skills/{skill.name}/
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content Body */}
        <div className="space-y-6 text-xs">
          {/* Description */}
          <div>
            <span className="text-[11px] uppercase font-bold text-[var(--text-dim)] tracking-wider block mb-1">
              Descrição da Habilidade
            </span>
            <p className="text-[var(--text-main)] leading-relaxed bg-[var(--bg-card-subtle)] p-3.5 rounded-xl border border-[var(--border-main)]">
              {skill.description || 'Nenhuma descrição fornecida no manifesto da skill.'}
            </p>
          </div>

          {/* SKILL.md Manual */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-bold text-[var(--text-dim)] tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Manual Principal (SKILL.md)</span>
              </span>
            </div>
            <div className="bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-xl p-5 max-h-96 overflow-y-auto">
              <div
                className="prose-rendered text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: skillMdRendered }}
              />
            </div>
          </div>

          {/* References Folder */}
          {skill.references && skill.references.length > 0 && (
            <div>
              <span className="text-[11px] uppercase font-bold text-[var(--text-dim)] tracking-wider flex items-center gap-1.5 mb-2">
                <Folder className="w-3.5 h-3.5 text-sky-700 dark:text-sky-300" />
                <span className="text-[var(--text-main)]">Documentos na pasta references/ ({skill.references.length})</span>
              </span>
              <div className="space-y-2">
                {skill.references.map((ref, idx) => (
                  <details
                    key={idx}
                    className="group bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-xl overflow-hidden"
                  >
                    <summary className="p-3 cursor-pointer text-xs font-bold text-sky-900 dark:text-sky-200 flex items-center justify-between select-none hover:bg-[var(--bg-card)] transition-colors">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-sky-700 dark:text-sky-300" />
                        <span>{ref.name}</span>
                        <span className="text-[11px] font-mono text-[var(--text-dim)] font-normal">
                          ({(ref.sizeBytes / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    </summary>
                    <div className="p-4 border-t border-[var(--border-main)] bg-[var(--bg-card)] max-h-80 overflow-y-auto">
                      <div
                        className="prose-rendered text-xs"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(ref.content) }}
                      />
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* Scripts Folder */}
          {skill.scripts && skill.scripts.length > 0 && (
            <div>
              <span className="text-[11px] uppercase font-bold text-[var(--text-dim)] tracking-wider flex items-center gap-1.5 mb-2">
                <Code2 className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
                <span className="text-[var(--text-main)]">Scripts & Utilitários na pasta scripts/ ({skill.scripts.length})</span>
              </span>
              <div className="space-y-2">
                {skill.scripts.map((sc, idx) => (
                  <details
                    key={idx}
                    className="group bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-xl overflow-hidden"
                  >
                    <summary className="p-3 cursor-pointer text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center justify-between select-none hover:bg-[var(--bg-card)] transition-colors">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
                        <span>{sc.name}</span>
                        <span className="text-[11px] font-mono text-[var(--text-dim)] font-normal">
                          ({(sc.sizeBytes / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    </summary>
                    <div className="p-4 border-t border-[var(--border-main)] bg-[var(--terminal-bg)] text-[var(--terminal-text)] font-mono text-xs max-h-80 overflow-auto relative">
                      {sc.content && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCopyCode(sc.content || '', String(idx))}
                          className="absolute top-2 right-2 h-7 px-2 text-[10px] gap-1 z-10 font-bold"
                        >
                          {copiedScript === String(idx) ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedScript === String(idx) ? 'Copiado' : 'Copiar'}</span>
                        </Button>
                      )}
                      <pre className="p-0 m-0 bg-transparent border-0 text-inherit">
                        <code>{sc.content || 'Script binário ou sem conteúdo de texto direto.'}</code>
                      </pre>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
