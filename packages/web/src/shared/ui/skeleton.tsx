import { cn } from '@shared/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  circle?: boolean;
}

function Skeleton({ className, circle, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted rounded-md',
        circle && 'rounded-full',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
