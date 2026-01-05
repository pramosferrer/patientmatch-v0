"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toConditionSlug } from "@/shared/conditions-normalize";
import { RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const STORAGE_KEY = "match_flow_v2";
const DISMISSED_KEY = "restore_search_dismissed";

export default function RestoreSearch() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [savedSearch, setSavedSearch] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Only show if no significant search params are present
        const hasCondition = searchParams?.has("condition") || searchParams?.has("conditions");
        const hasQuery = searchParams?.has("q");
        const hasStatus = searchParams?.has("status_bucket");

        if (hasCondition || hasQuery || hasStatus) {
            return;
        }

        // Check if dismissed in this session
        if (sessionStorage.getItem(DISMISSED_KEY)) {
            return;
        }

        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.answers && Object.keys(parsed.answers).length > 0) {
                    // Basic validation: ensure at least one meaningful answer exists
                    const { condition, age, zip } = parsed.answers;
                    if (condition?.value || age?.value || zip?.value) {
                        setSavedSearch(stored);
                        setIsVisible(true);
                    }
                }
            }
        } catch {
            // Ignore errors
        }
    }, [searchParams]);

    const handleRestore = () => {
        if (!savedSearch) return;

        try {
            const parsed = JSON.parse(savedSearch);
            const answers = parsed.answers;

            const params = new URLSearchParams();
            params.set("prefill", "1");

            const conditionRecord = answers.condition;
            const rawCondition =
                typeof conditionRecord?.value === "string"
                    ? conditionRecord.value
                    : conditionRecord?.value != null
                        ? String(conditionRecord.value)
                        : "";
            const normalizedCondition = rawCondition
                ? toConditionSlug(rawCondition)
                : "";
            const conditionParam = normalizedCondition || rawCondition;
            if (conditionParam) params.set("condition", conditionParam);

            const ageRecord = answers.age;
            const ageValue =
                typeof ageRecord?.value === "number" && !Number.isNaN(ageRecord.value)
                    ? ageRecord.value
                    : null;
            if (ageValue != null) params.set("age", String(ageValue));

            const zipRecord = answers.zip;
            if (typeof zipRecord?.value === "string" && zipRecord.value.trim()) {
                params.set("zip", zipRecord.value.trim());
            }

            const travelRecord = answers.travel;
            if (typeof travelRecord?.value === "number" && Number.isFinite(travelRecord.value)) {
                params.set("radius", String(travelRecord.value));
            } else if (typeof travelRecord?.value === "string" && travelRecord.value.trim()) {
                params.set("radius", travelRecord.value.trim());
            }

            const modalityRecord = answers.modality;
            if (typeof modalityRecord?.value === "string" && modalityRecord.value) {
                params.set("modality", modalityRecord.value);
                if (modalityRecord.value === "remote_only") {
                    params.set("remote", "1");
                }
            }

            const sexRecord = answers.sex;
            if (typeof sexRecord?.value === "string" && sexRecord.value !== "prefer_not") {
                params.set("sex", sexRecord.value);
            }

            router.push(`/trials?${params.toString()}`);
            setIsVisible(false);
        } catch (err) {
            console.error("Failed to restore search", err);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem(DISMISSED_KEY, "true");
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-4"
            >
                <div className="flex items-center justify-between gap-3 rounded-none bg-slate-100 p-3 px-4">
                    <div className="flex items-center gap-3">
                        <RotateCcw className="h-4 w-4 text-slate-400 shrink-0" />
                        <p className="text-sm text-slate-600">
                            Restore your last search?
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleRestore}
                            className="h-8 rounded-none px-4 bg-slate-200 text-slate-700 hover:bg-slate-300 font-semibold text-xs"
                        >
                            Restore
                        </Button>
                        <button
                            onClick={handleDismiss}
                            className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
