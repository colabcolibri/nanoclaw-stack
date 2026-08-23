import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

const ROOT = new URL('../src', import.meta.url).pathname

function migrate(content) {
  return content
    .replace(/\[var\((--[^)]+)\)\]/g, '($1)')
    .replace(/\bbreak-words\b/g, 'wrap-break-word')
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
