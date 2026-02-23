import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export const Card = ({ children, className, ...props }: CardProps) => (
  <div
    {...props}
    className={`rounded-2xl border border-border bg-card text-card-foreground shadow-sm ${className ?? ""}`}
  >
    {children}
  </div>
);
