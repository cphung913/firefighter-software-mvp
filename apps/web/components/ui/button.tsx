import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none font-display text-[13px] font-semibold uppercase tracking-[0.14em] transition-[background-color] duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--signal)] text-[var(--bone)] hover:bg-[var(--signal-deep)]",
        destructive:
          "bg-[var(--signal)] text-[var(--bone)] hover:bg-[var(--signal-deep)]",
        block:
          "bg-[var(--ink)] text-[var(--bone)] hover:bg-[var(--signal)]",
        outline:
          "border border-[var(--rule)] bg-transparent text-[var(--bone)] hover:bg-[rgba(243,238,229,0.08)]",
        secondary:
          "bg-[var(--steel)] text-[var(--bone)] hover:bg-[var(--steel-2)]",
        ghost:
          "border border-[rgba(243,238,229,0.35)] bg-transparent text-[var(--bone)] hover:bg-[rgba(243,238,229,0.08)]",
        link: "text-[var(--signal)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-[26px]",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { buttonVariants };
