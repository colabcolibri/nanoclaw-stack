import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-bold transition-colors select-none",
  {
    variants: {
      variant: {
        default: "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/60 dark:text-sky-300",
        secondary: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
        success: "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-300",
        destructive: "border-red-300 bg-red-100 text-red-900 dark:border-red-500/40 dark:bg-red-950/60 dark:text-red-300",
        warning: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-300",
        telegram: "border-sky-400/40 bg-sky-500/15 text-sky-800 dark:text-sky-300",
        macos: "border-slate-400/40 bg-slate-500/15 text-slate-800 dark:text-slate-200",
        cli: "border-purple-400/40 bg-purple-500/15 text-purple-800 dark:text-purple-300",
        web: "border-teal-400/40 bg-teal-500/15 text-teal-800 dark:text-teal-300",
        outline: "text-[var(--text-main)] border-[var(--border-main)] bg-[var(--bg-card)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
