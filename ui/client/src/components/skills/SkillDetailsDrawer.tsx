import React from 'react'
import { X, FileText, Code2, Folder, Copy, Check, Sparkles, CheckCircle2, Zap, AlignLeft } from 'lucide-react'
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
  const formatK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('pt-BR'))

  const totalTokens = skill.totalTokens || 0
  const totalChars = skill.totalChars || 0
  const skillMdTokens = skill.skillMdTokens || Math.ceil((skill.skillMdChars || (skill.skillMdContent || '').length) / 3.8)
  const skillMdChars = skill.skillMdChars || (skill.skillMdContent || '').length

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
      onClick={onClose}
    >
      {/* Drawer Panel */}
      <div
        className="relative w-full max-w-2xl bg-[var(--bg-card)] border-l border-[var(--border-main)] shadow-2xl p-6 flex flex-col z-10 overflow-y-auto animate-in slide-in-from-right duration-200 text-[var(--text-main)] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
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

        {/* Footprint Metrics Summary */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-xl flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--text-dim)] tracking-wider block">
                Tokens Estimados
              </span>
              <span className="text-sm font-bold text-[var(--text-main)] font-mono">
                ~{formatK(totalTokens)} tok
              </span>
            </div>
          </div>

          <div className="p-3 bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-xl flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <AlignLeft className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--text-dim)] tracking-wider block">
                Total de Caracteres
              </span>
              <span className="text-sm font-bold text-[var(--text-main)] font-mono">
                {totalChars.toLocaleString('pt-BR')} chars
              </span>
            </div>
          </div>
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
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <span className="text-[11px] uppercase font-bold text-[var(--text-dim)] tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Manual Principal (SKILL.md)</span>
              </span>
              <div className="flex items-center gap-1.5">
                <Badge variant="tokens" className="text-[10px] py-0 px-2 gap-1 font-bold">
                  <Zap className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                  <span>~{formatK(skillMdTokens)} tok</span>
                </Badge>
                <Badge variant="chars" className="text-[10px] py-0 px-2 gap-1 font-bold">
                  <AlignLeft className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                  <span>{skillMdChars.toLocaleString('pt-BR')} chars</span>
                </Badge>
              </div>
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
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="text-[11px] uppercase font-bold text-[var(--text-dim)] tracking-wider flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-sky-700 dark:text-sky-300" />
                  <span className="text-[var(--text-main)]">Documentos na pasta references/ ({skill.references.length})</span>
                </span>
                {skill.referencesTokens !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="tokens" className="text-[10px] py-0 px-2 gap-1 font-bold">
                      <Zap className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                      <span>~{formatK(skill.referencesTokens)} tok</span>
                    </Badge>
                    <Badge variant="chars" className="text-[10px] py-0 px-2 gap-1 font-bold">
                      <AlignLeft className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                      <span>{(skill.referencesChars || 0).toLocaleString('pt-BR')} chars</span>
                    </Badge>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {skill.references.map((ref, idx) => {
                  const rChars = ref.charCount ?? ref.content.length
                  const rTokens = ref.tokenCount ?? Math.ceil(rChars / 3.8)
                  return (
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
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-amber-800 dark:text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            ~{formatK(rTokens)} tok
                          </span>
                          <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {rChars.toLocaleString('pt-BR')} chars
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
                  )
                })}
              </div>
            </div>
          )}

          {/* Scripts Folder */}
          {skill.scripts && skill.scripts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="text-[11px] uppercase font-bold text-[var(--text-dim)] tracking-wider flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
                  <span className="text-[var(--text-main)]">Scripts & Utilitários na pasta scripts/ ({skill.scripts.length})</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="script" className="text-[10px] py-0 px-2 gap-1 font-bold">
                    <Code2 className="w-3 h-3 text-purple-700 dark:text-purple-300" />
                    <span>0 tok (Execução Local)</span>
                  </Badge>
                  <Badge variant="chars" className="text-[10px] py-0 px-2 gap-1 font-bold">
                    <AlignLeft className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                    <span>{(skill.scriptsChars || 0).toLocaleString('pt-BR')} chars</span>
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                {skill.scripts.map((sc, idx) => {
                  const sChars = sc.charCount ?? (sc.content || '').length
                  return (
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
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-purple-800 dark:text-purple-300 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                            0 tok • local
                          </span>
                          <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {sChars.toLocaleString('pt-BR')} chars
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
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

