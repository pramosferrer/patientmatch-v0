"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type MicroScreenerProps = {
  conditionSlug: string;
  conditionLabel: string;
  className?: string;
};

const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];
const ZIP_RE = /^\d{5}$/;

export default function MicroScreener({
  conditionSlug,
  conditionLabel,
  className,
}: MicroScreenerProps) {
  const router = useRouter();
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [zip, setZip] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedAge = age.trim();
    const trimmedZip = zip.trim();

    if (trimmedAge) {
      const parsedAge = Number(trimmedAge);
      if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120) {
        setError("Enter a valid age between 0 and 120.");
        return;
      }
    }

    if (trimmedZip && !ZIP_RE.test(trimmedZip)) {
      setError("Enter a valid 5-digit ZIP code, or leave it blank.");
      return;
    }

    setError(null);
    const params = new URLSearchParams();
    if (conditionSlug) params.set("condition", conditionSlug);
    if (trimmedAge) params.set("age", trimmedAge);
    if (sex) params.set("sex", sex);
    if (trimmedZip) params.set("zip", trimmedZip);
    const query = params.toString();
    router.push(query ? `/trials?${query}` : "/trials");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-3xl border border-hairline bg-white/95 p-6 shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Micro screener
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">
            Start with the basics.
          </h2>
        </div>
        <Link
          href="/trials"
          className="text-sm font-medium text-primary underline-offset-4 transition hover:text-primary/80 hover:underline"
        >
          Full screener
        </Link>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-warm-cream/80 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Condition
        </p>
        <p className="text-base font-semibold text-foreground">
          {conditionLabel}
        </p>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="micro-age">Age</Label>
          <Input
            id="micro-age"
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            placeholder="e.g., 45"
            value={age}
            onChange={(event) => {
              setAge(event.target.value);
              if (error) setError(null);
            }}
            variant="screener"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="micro-sex">Sex at birth</Label>
          <Select
            value={sex}
            onValueChange={(value) => {
              setSex(value);
              if (error) setError(null);
            }}
          >
            <SelectTrigger id="micro-sex" className="h-12 rounded-2xl">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {SEX_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="micro-zip">ZIP code</Label>
          <Input
            id="micro-zip"
            inputMode="numeric"
            placeholder="e.g., 94107"
            value={zip}
            onChange={(event) => {
              setZip(event.target.value.replace(/\D/g, "").slice(0, 5));
              if (error) setError(null);
            }}
            variant="screener"
            maxLength={5}
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" variant="brand" className="mt-5 w-full">
        See matches
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        No personal info required. Update details anytime.
      </p>
    </form>
  );
}
