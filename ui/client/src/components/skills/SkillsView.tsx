import React, { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, Save, Search, Check, AlertCircle, Folder, Code2, Zap, AlignLeft, Layers } from 'lucide-react'
import { ApiClient, type SkillItem } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SkillDetailsDrawer } from '@/components/skills/SkillDetailsDrawer'

export const SkillsView: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [mode, setMode] = useState<'all' | 'custom'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadSkills()
  }, [])

  const loadSkills = async () => {
    setIsLoading(true)
    try {
      const data = await ApiClient.getSkills('barao')
      setSkills(data.skills || [])
      setMode(data.mode || 'all')
    } catch {} finally {
      setIsLoading(false)
    }
  }

  const handleToggleSkill = (skillName: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.name === skillName ? { ...s, enabled: !s.enabled } : s))
    )
    if (mode === 'all') {
      setMode('custom')
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const enabledSkillNames = skills.filter((s) => s.enabled).map((s) => s.name)
      await ApiClient.saveSkills('barao', mode, enabledSkillNames)
      setToastMessage({ text: 'Skills atualizadas com sucesso!', type: 'success' })
      setTimeout(() => setToastMessage(null), 3000)
    } catch {
      setToastMessage({ text: 'Erro ao salvar configuração de skills.', type: 'error' })
      setTimeout(() => setToastMessage(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleInspectSkill = (skill: SkillItem) => {
    setSelectedSkill(skill)
    setIsDrawerOpen(true)
  }

  const filteredSkills = skills.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
  })

  // Cumulative Context footprint metrics
  const activeSkills = skills.filter((s) => (mode === 'all' ? true : s.enabled))
  const totalActiveSkills = activeSkills.length
  const totalActiveTokens = activeSkills.reduce((acc, s) => acc + (s.totalTokens || 0), 0)
  const totalActiveChars = activeSkills.reduce((acc, s) => acc + (s.totalChars || 0), 0)

  const formatK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('pt-BR'))

  return (
    <div className="flex flex-col gap-6 w-full flex-1">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-900 dark:text-red-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header with Save & Refresh */}
      <PageHeader
        icon={<Sparkles className="w-5 h-5" />}
        title="Ferramentas & Skills Habilitadas"
        subtitle="Controle as habilidades modulares, manuais SKILL.md e scripts de automação disponíveis para o Barão."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={loadSkills}
              disabled={isLoading}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9 gap-1.5 text-xs font-bold shadow-xs px-4"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Skills'}</span>
            </Button>
          </div>
        }
      />

      {/* Mode Control & Search Bar */}
      <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Mode Selector */}
        <div className="flex items-center gap-4 text-xs">
          <span className="font-bold text-[var(--text-main)]">Modo de Carga:</span>
          <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-[var(--text-main)]">
            <input
              type="radio"
              name="skillMode"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
              className="text-sky-600 focus:ring-0 cursor-pointer"
            />
            <span>Habilitar Todas ("all")</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-[var(--text-main)]">
            <input
              type="radio"
              name="skillMode"
              checked={mode === 'custom'}
              onChange={() => setMode('custom')}
              className="text-sky-600 focus:ring-0 cursor-pointer"
            />
            <span>Personalizado ("custom")</span>
          </label>
        </div>

        {/* Search Box */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-[var(--text-dim)] absolute left-3 top-3" />
          <input
            type="text"
            className="w-full pl-8 pr-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 placeholder:text-[var(--text-dim)]"
            placeholder="Buscar skill ou comando..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Context Footprint Summary Banner */}
      <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span className="font-bold text-[var(--text-main)]">Pegada de Contexto das Skills Ativas:</span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Badge variant="default" className="text-xs py-1 px-3 gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{totalActiveSkills} de {skills.length} skills ativas</span>
          </Badge>

          <Badge variant="tokens" className="text-xs py-1 px-3 gap-1.5 font-bold">
            <Zap className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
            <span>~{formatK(totalActiveTokens)} tokens estimados</span>
          </Badge>

          <Badge variant="chars" className="text-xs py-1 px-3 gap-1.5 font-bold">
            <AlignLeft className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
            <span>{totalActiveChars.toLocaleString('pt-BR')} caracteres</span>
          </Badge>
        </div>
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSkills.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={<Sparkles className="w-8 h-8 text-[var(--text-dim)]" />}
              title="Nenhuma habilidade encontrada"
              description={searchQuery ? 'Nenhuma skill corresponde à sua busca.' : 'Carregando lista de skills do contêiner...'}
            />
          </div>
        ) : (
          filteredSkills.map((skill) => {
            const isEnabled = mode === 'all' ? true : skill.enabled
            const refCount = skill.references ? skill.references.length : 0
            const scriptCount = skill.scripts ? skill.scripts.length : 0
            const skillTokens = skill.totalTokens || 0
            const skillChars = skill.totalChars || 0

            return (
              <Card
                key={skill.name}
                className={`border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs transition-all flex flex-col justify-between ${
                  isEnabled ? 'ring-1 ring-[var(--accent-border)]' : 'opacity-80'
                }`}
              >
                <CardHeader className="p-4 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <CardTitle className="text-xs font-bold text-[var(--text-main)] font-mono">
                          {skill.name}
                        </CardTitle>
                      </div>

                      {/* Metrics and Files Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="tokens" className="text-[10px] py-0 px-2 gap-1 font-bold">
                          <Zap className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                          <span>~{formatK(skillTokens)} tok</span>
                        </Badge>
                        <Badge variant="chars" className="text-[10px] py-0 px-2 gap-1 font-bold">
                          <AlignLeft className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                          <span>{formatK(skillChars)} chars</span>
                        </Badge>
                        {refCount > 0 && (
                          <Badge variant="ref" className="text-[10px] py-0 px-2 gap-1 font-bold">
                            <Folder className="w-3 h-3 text-sky-800 dark:text-sky-300" />
                            <span>{refCount} ref</span>
                          </Badge>
                        )}
                        {scriptCount > 0 && (
                          <Badge variant="script" className="text-[10px] py-0 px-2 gap-1 font-bold">
                            <Code2 className="w-3 h-3 text-purple-800 dark:text-purple-300" />
                            <span>{scriptCount} script</span>
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Enable Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggleSkill(skill.name)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--border-main)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                    </label>
                  </div>
                </CardHeader>

                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3 font-normal">
                    {skill.description || 'Habilidade nativa de automação e execução.'}
                  </p>

                  <div className="pt-2 border-t border-[var(--border-main)] flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInspectSkill(skill)}
                      className="w-full gap-1.5 text-xs font-bold h-8 border-[var(--border-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-subtle)] text-[var(--text-main)]"
                    >
                      <Search className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Abrir Detalhes</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Skill Inspector Drawer */}
      <SkillDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        skill={selectedSkill}
      />
    </div>
  )
}

