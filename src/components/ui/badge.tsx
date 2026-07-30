import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary ring-primary/20',
        pending: 'bg-amber-50 text-amber-700 ring-amber-200',
        approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        rejected: 'bg-red-50 text-red-700 ring-red-200',
        secondary: 'bg-muted text-muted-foreground ring-border',
        outline: 'bg-transparent text-foreground ring-border',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
