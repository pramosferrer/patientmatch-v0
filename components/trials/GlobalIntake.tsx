"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConditionCombobox } from "@/components/ConditionCombobox";
import { Input } from "@/components/ui/input";
import { MapPin, Search } from "lucide-react";

interface GlobalIntakeProps {
    initialCondition?: string;
    initialZip?: string;
}

export default function GlobalIntake({ initialCondition: propCondition = "", initialZip: propZip = "" }: GlobalIntakeProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialCondition = searchParams.get("condition") || propCondition || "";
    const initialZip = searchParams.get("zip") || propZip || "";

    const [condition, setCondition] = useState(initialCondition);
    const [zip, setZip] = useState(initialZip);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSearch = useCallback(() => {
        setIsSubmitting(true);
        const params = new URLSearchParams(searchParams.toString());

        if (condition) {
            params.set("condition", condition);
        } else {
            params.delete("condition");
        }

        if (zip.trim()) {
            params.set("zip", zip.trim());
        } else {
            params.delete("zip");
        }

        // Reset page to 1 on new search
        params.delete("page");
        params.delete("mode");

        router.push(`/trials?${params.toString()}`);
        setIsSubmitting(false);
    }, [condition, zip, router, searchParams]);

    return (
        <div className="w-full rounded-2xl border border-hairline bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-4">
                <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-foreground">
                        Find trials near you
                    </h2>
                    <p className="text-muted-foreground">
                        Enter your condition and zip code to see the best matches first.
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
                    <div className="relative z-20">
                        <ConditionCombobox
                            value={condition}
                            onChange={setCondition}
                            placeholder="Select a condition..."
                        />
                    </div>

                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={zip}
                            onChange={(e) => setZip(e.target.value)}
                            placeholder="Zip Code"
                            className="pl-9"
                            maxLength={5}
                        />
                    </div>

                    <Button
                        onClick={handleSearch}
                        disabled={isSubmitting}
                        className="w-full md:w-auto"
                        size="default"
                    >
                        {isSubmitting ? (
                            "Searching..."
                        ) : (
                            <>
                                <Search className="mr-2 h-4 w-4" />
                                Search
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
