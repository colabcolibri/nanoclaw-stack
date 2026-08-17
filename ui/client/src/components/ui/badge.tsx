import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-bold transition-colors select-none",
  {
    variants: {
      variant: {
        default: "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-500/50 dark:bg-sky-950/80 dark:text-sky-200",
        secondary: "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
        success: "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-950/80 dark:text-emerald-200",
        destructive: "border-red-300 bg-red-100 text-red-950 dark:border-red-500/50 dark:bg-red-950/80 dark:text-red-200",
        warning: "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/80 dark:text-amber-200",
        ref: "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-500/50 dark:bg-sky-950/80 dark:text-sky-200",
        script: "border-purple-300 bg-purple-100 text-purple-950 dark:border-purple-500/50 dark:bg-purple-950/80 dark:text-purple-200",
        telegram: "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-500/50 dark:bg-sky-950/80 dark:text-sky-200",
        macos: "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
        cli: "border-purple-300 bg-purple-100 text-purple-950 dark:border-purple-500/50 dark:bg-purple-950/80 dark:text-purple-200",
        web: "border-teal-300 bg-teal-100 text-teal-950 dark:border-teal-500/50 dark:bg-teal-950/80 dark:text-teal-200",
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
