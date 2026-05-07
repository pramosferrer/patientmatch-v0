"use client";

import * as React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  "data-testid"?: string;
};

const ScreenerInput = React.forwardRef<HTMLInputElement, Props>(function ScreenerInput(
  { className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      autoComplete="off"
      className={[
        "relative z-10 block w-full h-12 min-h-[3rem] rounded-xl",
        "bg-white text-zinc-900 placeholder:text-zinc-500",
        "border border-zinc-300 shadow-sm",
        "px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      ].join(" ")}
      {...props}
    />
  );
});

export default ScreenerInput;
