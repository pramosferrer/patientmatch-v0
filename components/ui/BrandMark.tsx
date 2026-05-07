"use client";
import { Cross } from "lucide-react";

export default function BrandMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card">
      <Cross className={className} />
    </div>
  );
}

