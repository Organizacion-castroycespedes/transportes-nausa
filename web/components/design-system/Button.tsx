import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "disabled";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
};

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring",
  secondary:
    "bg-foreground text-background shadow-sm hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-foreground",
  outline:
    "bg-transparent text-foreground border border-border hover:bg-muted",
  ghost:
    "bg-transparent text-foreground border border-border hover:bg-muted",
  disabled:
    "bg-muted text-muted-foreground border border-border focus-visible:ring-2 focus-visible:ring-ring",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = ({
  variant = "primary",
  size = "md",
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none ${sizeStyles[size]} ${variantStyles[variant]} ${className ?? ""}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
};
