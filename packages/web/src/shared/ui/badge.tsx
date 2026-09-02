import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-[0.005em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-hairline bg-muted text-muted-foreground',
        primary: 'border-accent/15 bg-accent-light text-accent',
        success: 'border-success/15 bg-success-light text-success',
        warning: 'border-warning/15 bg-warning-light text-warning',
        danger: 'border-danger/15 bg-danger-light text-danger',
        signal: 'border-signal/25 bg-signal-light text-signal',
        outline: 'border-hairline text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
