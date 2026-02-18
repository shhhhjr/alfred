import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-zinc-700 text-zinc-200",
        secondary: "border-transparent bg-yellow-900/50 text-yellow-300",
        destructive: "border-transparent bg-red-900/50 text-red-300",
        outline: "border-zinc-700 bg-transparent text-zinc-300",
        exam: "border-transparent bg-red-900/50 text-red-300",
        assignment: "border-transparent bg-orange-900/50 text-orange-300",
        work: "border-transparent bg-blue-900/50 text-blue-300",
        personal: "border-transparent bg-green-900/50 text-green-300",
        errand: "border-transparent bg-zinc-600 text-zinc-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
