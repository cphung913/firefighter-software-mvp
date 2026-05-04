import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full border-0 border-b border-b-[var(--steel)] bg-transparent px-0 py-2 text-[15px] font-body text-[var(--ink)] resize-y placeholder:text-[#a09a8e] focus-visible:outline-none focus-visible:border-b-[var(--signal)] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
