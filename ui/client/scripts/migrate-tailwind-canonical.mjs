import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

const ROOT = new URL('../src', import.meta.url).pathname

/** Replacements ordered longest-first to avoid partial matches. */
const REPLACEMENTS = [
  ['data-[state=active]:border-(--accent)', 'data-[state=active]:border-accent'],
  ['data-[state=active]:text-(--accent)', 'data-[state=active]:text-accent'],
  ['group-hover:text-(--accent)', 'group-hover:text-accent'],
  ['hover:text-(--destructive)', 'hover:text-destructive'],
  ['hover:text-(--accent)', 'hover:text-accent'],
  ['text-[var(--text-dim)]', 'text-(--text-dim)'],
  ['text-(--destructive)', 'text-destructive'],
  ['text-(--accent)', 'text-accent'],
  ['[scrollbar-width:none]', 'scrollbar-none'],
  ['max-w-[14rem]', 'max-w-56'],
  ['break-words', 'wrap-break-word'],
]

function migrate(content) {
  let result = content.replace(/\[var\((--[^)]+)\)\]/g, '($1)')
  for (const [from, to] of REPLACEMENTS) {
    result = result.split(from).join(to)
  }
  return result
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  let changed = 0

  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      changed += await walk(path)
      continue
    }

    const ext = extname(entry.name)
    if (ext !== '.tsx' && ext !== '.ts') continue

    const before = await readFile(path, 'utf8')
    const after = migrate(before)
    if (after !== before) {
      await writeFile(path, after, 'utf8')
      changed += 1
      console.log(`updated: ${path}`)
    }
  }

  return changed
}

const count = await walk(ROOT)
console.log(`done. ${count} file(s) updated.`)
