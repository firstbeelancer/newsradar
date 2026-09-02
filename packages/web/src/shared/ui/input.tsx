import * as React from 'react';
import { cn } from '@shared/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, helper, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-[13px] font-semibold text-ink-700">
            {label}
            {props.required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-xl border bg-white px-3 py-2 text-sm text-foreground transition-all',
            'placeholder:text-ink-300',
            'focus:outline-none nr-input-glow',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
            'hover:border-border',
            error
              ? 'border-danger focus:shadow-[0_0_0_3px_rgba(201,60,60,0.14)]'
              : 'border-hairline',
            className
          )}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${props.id}-error` : helper ? `${props.id}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${props.id}-error`} className="text-xs text-danger">
            {error}
          </p>
        )}
        {helper && !error && (
          <p id={`${props.id}-helper`} className="text-xs text-muted-foreground">
            {helper}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
