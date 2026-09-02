import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@shared/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 cursor-pointer select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        // Solid azure with an inner highlight reads as a machined control;
        // the old blue-to-cyan gradient read as a generic SaaS button.
        default: 'nr-brand-button nr-btn-glow',
        primary: 'nr-brand-button nr-btn-glow',
        danger:
          'bg-danger text-white hover:bg-[#b23434] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_rgba(201,60,60,0.28)] border border-white/10',
        ghost: 'text-ink-700 hover:bg-white hover:shadow-[var(--shadow-xs)]',
        outline:
          'border border-hairline bg-white/80 backdrop-blur-sm text-foreground hover:border-border hover:bg-white hover:shadow-[var(--shadow-sm)]',
        secondary:
          'bg-white text-foreground border border-hairline hover:border-border hover:shadow-[var(--shadow-sm)]',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-lg',
        md: 'h-10 px-4 py-2',
        lg: 'h-12 px-6 text-base rounded-xl',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
