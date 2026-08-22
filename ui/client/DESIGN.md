---
name: NanoClaw Dashboard
colors:
  background: '#f1f5f9'
  background-dark: '#050810'
  surface: '#ffffff'
  surface-dark: '#0c1222'
  surface-subtle: '#f8fafc'
  surface-subtle-dark: '#111a2e'
  foreground: '#0f172a'
  foreground-dark: '#f1f5f9'
  muted: '#475569'
  muted-dark: '#94a3b8'
  border: '#e2e8f0'
  border-dark: '#1e2d4a'
  primary: '#0284c7'
  primary-dark: '#38bdf8'
  primary-foreground: '#ffffff'
  secondary: '#f1f5f9'
  secondary-dark: '#111a2e'
  accent: '#0ea5e9'
  destructive: '#ef4444'
  success: '#10b981'
  warning: '#f59e0b'
typography:
  font-family: 'Plus Jakarta Sans'
  font-mono: 'JetBrains Mono'
  page-title: 24px/1.3/600
  section-title: 18px/1.4/600
  body: 14px/1.5/400
  label: 12px/1.2/600 uppercase tracking-wide
  caption: 12px/1.4/400
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
spacing:
  sidebar: 280px
  topbar: 56px
  content-max: 1280px
  card-padding: 24px
  section-gap: 32px
---

# DESIGN.md — NanoClaw Dashboard

## Product
Self-hosted AI assistant operations dashboard. Audience: technical operators managing agents, skills, MCP integrations, schedules, token usage, and system config. Tone: professional, calm, trustworthy — like Linear or Vercel dashboard, not playful consumer app.

## Tech constraints (must respect in generated UI)
- **Component library:** shadcn/ui (Radix primitives + Tailwind)
- **Stack:** React 19, TypeScript, Tailwind CSS v4, lucide-react icons
- **Keep:** existing 13 navigation sections grouped in sidebar
- **Refactor goal:** replace hand-rolled modals/drawers/tabs/inputs with shadcn Dialog, Sheet, Tabs, Input, Select, Table, DropdownMenu, Badge, Card, Button

## Layout shell
- Fixed left sidebar (280px), collapsible on mobile with overlay
- Top bar (56px): page title, agent name badge, online status, theme toggle, language toggle, logout
- Main content: max-width 1280px, generous padding (24–32px)
- Optional stats grid row on Chat and Usage views only

## Sidebar navigation groups
1. **Comunicação:** Chat
2. **Inteligência:** Agentes, Soul, Skills, MCPs
3. **Automação:** Rotinas, Execuções
4. **Governança:** Uso, Modelos, Logs, Segurança, Configuração, Serviço

Active nav item: solid primary background, white text. Inactive: muted text, subtle hover.

## Color system
Light mode page bg `#f1f5f9`, cards white, borders `#e2e8f0`, text `#0f172a`, accent sky `#0284c7`.
Dark mode page bg `#050810`, cards `#0c1222`, borders `#1e2d4a`, text `#f1f5f9`, accent `#38bdf8`.

## Typography
Plus Jakarta Sans for all UI. Clear hierarchy: page title 24px semibold, section headers 18px, body 14px, labels 12px uppercase with tracking.

## Components (shadcn patterns)
- **Cards:** Card + CardHeader + CardTitle + CardDescription + CardContent with subtle shadow
- **Tables:** shadcn Table for agents list, runs history, token ledger
- **Forms:** Label + Input + Select + Textarea with consistent spacing
- **Drawers:** Sheet component for agent details, skill details (right side, 480px)
- **Modals:** Dialog for create agent, confirm delete
- **Tabs:** TabsList + TabsTrigger inside drawers
- **Badges:** status chips (online, active, error) with semantic colors
- **Empty states:** centered icon + title + description + CTA button
- **Page header:** title + description + action buttons row

## Priority screens to redesign
1. **Dashboard shell** — sidebar + topbar + agents view content
2. **Agents** — department filter chips, search, agent cards grid, detail sheet
3. **MCPs** — integration cards (Google, Notion, Yampi), OAuth connect buttons
4. **Schedules** — cron routine list with create/edit dialog
5. **Usage/Analytics** — token spend charts, cost breakdown table

## Avoid
- Generic bootstrap admin look
- Overly dense tables without breathing room
- Custom modal HTML (div + fixed inset-0)
- Native `<select>` elements
- Inconsistent border radius (mix of rounded-lg and rounded-xl)
- Hardcoded Portuguese only — leave room for i18n labels

## Responsive
- Mobile: sidebar off-canvas, single column cards, stacked form fields
- Tablet: 2-column card grid
- Desktop: 3-column agent grid, sidebar always visible
