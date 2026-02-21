import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "disabled";
  children: ReactNode;
};

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600",
  secondary:
    "bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900",
  ghost:
    "bg-transparent text-slate-900 border border-slate-200 hover:bg-slate-50",
  disabled:
    "bg-transparent bg-slate-200 text-slate-400 border border-slate-200 focus-visible:ring-2 focus-visible:ring-slate-900",
};

export const Button = ({
  variant = "primary",
  children,
  className,
  type = "button",
  ...props
}: ButtonProps) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none ${variantStyles[variant]} ${className ?? ""}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
};
