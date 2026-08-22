import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { type MarkdownDoc } from '@/api/client'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SoulDocSelectProps {
  docs: MarkdownDoc[]
  value: string
  onValueChange: (path: string) => void
  disabled?: boolean
}

export const SoulDocSelect: React.FC<SoulDocSelectProps> = ({
  docs,
  value,
  onValueChange,
  disabled,
}) => {
  const { t } = useTranslation('soul')

  const groupedDocs = useMemo(() => {
    const groups = new Map<string, MarkdownDoc[]>()
    for (const doc of docs) {
      const category = doc.category || t('categoryOther')
      const list = groups.get(category) || []
      list.push(doc)
      groups.set(category, list)
    }
    return Array.from(groups.entries())
  }, [docs, t])

  const selectedDoc = docs.find((d) => d.relativePath === value)

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled || docs.length === 0}>
      <SelectTrigger className="h-9 w-full min-w-0 font-mono text-xs">
        <SelectValue placeholder={t('selectDoc')}>
          {selectedDoc?.relativePath || value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {groupedDocs.map(([category, items]) => (
          <SelectGroup key={category}>
            <SelectLabel>{category}</SelectLabel>
            {items.map((doc) => (
              <SelectItem key={doc.relativePath} value={doc.relativePath} className="font-mono text-xs">
                {doc.title}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
