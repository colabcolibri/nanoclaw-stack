import React from 'react'
import { useTranslation } from 'react-i18next'
import { Bot } from 'lucide-react'
import { type DepartmentItem } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface CreateAgentFormState {
  id: string
  name: string
  department: string
  role: string
}

interface CreateAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: DepartmentItem[]
  form: CreateAgentFormState
  onChange: (patch: Partial<CreateAgentFormState>) => void
  onSubmit: (e: React.FormEvent) => void
  isCreating: boolean
}

export const CreateAgentDialog: React.FC<CreateAgentDialogProps> = ({
  open,
  onOpenChange,
  departments,
  form,
  onChange,
  onSubmit,
  isCreating,
}) => {
  const { t } = useTranslation('agents')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-(--border-main) bg-(--bg-card)">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5 text-(--accent)" />
            {t('createTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="agent-id">{t('createId')}</Label>
            <Input
              id="agent-id"
              value={form.id}
              onChange={(e) =>
                onChange({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })
              }
              placeholder={t('createIdPlaceholder')}
              required
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-name">{t('createName')}</Label>
            <Input
              id="agent-name"
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={t('createNamePlaceholder')}
              required
              className="text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('createDept')}</Label>
            <Select value={form.department} onValueChange={(v) => onChange({ department: v })}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-role">{t('createRole')}</Label>
            <Input
              id="agent-role"
              value={form.role}
              onChange={(e) => onChange({ role: e.target.value })}
              placeholder={t('createRolePlaceholder')}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" type="button" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button variant="default" size="sm" type="submit" disabled={isCreating}>
              {isCreating ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
