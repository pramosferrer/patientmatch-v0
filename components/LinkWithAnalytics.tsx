"use client";
import Link from "next/link";
import { logEvent } from "@/lib/analytics";

export default function LinkWithAnalytics(
  { href, event, children, ...props }:
  { href: string; event: string; children: React.ReactNode } & React.ComponentProps<typeof Link>
){
  const onClick = async () => {
    try {
      await logEvent(event);
    } catch {}
  };
  return <Link href={href} onClick={onClick} {...props}>{children}</Link>;
}
