import { marked } from 'marked'
import DOMPurify from 'dompurify'

const renderer = new marked.Renderer()
renderer.link = ({ href, title, text }) => {
  const titleAttr = title ? ` title="${title}"` : ''
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
}

marked.use({
  renderer,
  breaks: true,
  gfm: true,
})

export function parseMarkdown(text: string): string {
  if (!text) return ''
  try {
    const rawHtml = marked.parse(text) as string
    return DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['target', 'rel'],
    })
  } catch (err) {
    console.warn('Markdown parse error:', err)
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
  }
}
