"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useDebounce } from "@/hooks/useDebounce";
import { getConditionSuggestionsAction } from "@/app/actions";
import { type ConditionSuggestion } from "@/lib/conditions";
import { toConditionSlug } from "@/shared/conditions-normalize";

interface ConditionComboboxProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function ConditionCombobox({
    value,
    onChange,
    placeholder = "Search condition...",
    className,
}: ConditionComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(value);
    const [suggestions, setSuggestions] = React.useState<ConditionSuggestion[]>([]);
    const [loading, setLoading] = React.useState(false);

    const debouncedInput = useDebounce(inputValue, 300);

    React.useEffect(() => {
        async function fetchSuggestions() {
            if (!debouncedInput || debouncedInput.length < 2) {
                setSuggestions([]);
                return;
            }
            setLoading(true);
            try {
                const results = await getConditionSuggestionsAction(debouncedInput);
                setSuggestions(results);
            } catch (error) {
                console.error("Failed to fetch suggestions", error);
            } finally {
                setLoading(false);
            }
        }
        fetchSuggestions();
    }, [debouncedInput]);

    // Sync internal input value with external value if it changes externally
    React.useEffect(() => {
        setInputValue(value);
    }, [value]);

    const isUnknown = value && toConditionSlug(value) === "other";

    return (
        <div className="relative w-full">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between h-12 px-4 !rounded-lg text-left font-normal border-hairline",
                            "bg-white/90 shadow-sm transition-all focus:ring-0 focus:ring-primary/20",
                            className

                        )}
                    >
                        <span className="truncate">
                            {value || placeholder}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0 bg-white border border-border shadow-2xl z-[100]"
                    align="start"
                    sideOffset={8}
                >
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Start typing..."
                            value={inputValue}
                            onValueChange={setInputValue}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && inputValue) {
                                    onChange(inputValue);
                                    setOpen(false);
                                }
                            }}
                        />
                        <CommandList className="pt-1">
                            {loading && (
                                <div className="flex items-center justify-center p-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                                </div>
                            )}
                            {!loading && suggestions.length === 0 && debouncedInput.length >= 2 && (
                                <CommandEmpty>
                                    <div className="p-4 text-sm text-muted-foreground">
                                        No matching conditions found. You can still use this as free-text.
                                    </div>
                                </CommandEmpty>
                            )}
                            <CommandGroup>
                                {suggestions.map((s) => (
                                    <CommandItem
                                        key={s.slug + s.label}
                                        value={s.label}
                                        onSelect={(currentValue) => {
                                            onChange(currentValue);
                                            setInputValue(currentValue);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === s.label ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {s.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {
                isUnknown && !open && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-600 font-medium px-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>Note: This condition might have fewer specific matches.</span>
                    </div>
                )
            }
        </div >
    );
}
