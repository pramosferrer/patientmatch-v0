import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "pm-button disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "pm-button-primary text-primary-foreground",
        destructive:
          "pm-button bg-destructive text-destructive-foreground border border-destructive/30 hover:bg-[color-mix(in_oklab,var(--color-destructive) 88%, #3E2F2F 12%)]",
        outline:
          "pm-button border border-hairline bg-white text-foreground hover:bg-[color-mix(in_oklab,var(--color-foreground) 6%, transparent)]",
        secondary: "pm-button-secondary",
        ghost:
          "pm-button bg-transparent text-foreground hover:bg-[color-mix(in_oklab,var(--color-foreground) 4%, transparent)]",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/90 px-0 h-auto",
        brand: "pm-button-primary text-primary-foreground",
        inverted:
          "pm-button border border-primary/30 bg-transparent text-primary hover:bg-[color-mix(in_oklab,var(--color-primary) 12%, transparent)]",
      },
      size: {
        default: "",
        sm: "pm-button-compact",
        lg: "h-12 rounded-md px-6 text-base",
        icon: "pm-button-compact w-10 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "brand" | "inverted";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
