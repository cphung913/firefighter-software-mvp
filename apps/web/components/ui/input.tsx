import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-11 w-full border-0 border-b border-b-[var(--rule-strong)] bg-transparent px-0 py-2 text-[15px] font-body text-inherit file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#9a9891] focus-visible:outline-none focus-visible:border-b-[var(--signal)] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
