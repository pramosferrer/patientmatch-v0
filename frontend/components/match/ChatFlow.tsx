"use client";
import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import { Send, User, Bot, Loader2 } from "lucide-react";
import type { PatientProfile } from "@/shared/match/types";

type Message = {
  id: number;
  type: "bot" | "user";
  content: string;
  timestamp: Date;
};

type ExtractedEntities = {
  condition?: string;
  age?: number;
  zip?: string;
  remote?: boolean;
};

type TrialSummary = {
  nct_id: string;
  title: string;
  sponsor?: string;
  phase?: string;
  status?: string;
  condition_slugs?: string[];
  original_conditions?: string[];
  criteria_json?: unknown;
  site_count?: number;
  distance_km?: number;
  why?: string[];
};

type ChatProfile = Omit<Partial<PatientProfile>, "location"> & {
  location?: { zip?: string | null; country?: string };
};

type ChatFlowProps = {
  onShortlist: (shortlist: TrialSummary[]) => void;
  patientProfile: ChatProfile;
  setPatientProfile: Dispatch<SetStateAction<ChatProfile>>;
};

export default function ChatFlow({ onShortlist, patientProfile, setPatientProfile }: ChatFlowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: "Hi! I'm here to help you find relevant clinical trials. Let's start with a few questions about your health situation.",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPreviewKeyRef = useRef<string | null>(null);

  const questions = [
    "What condition or symptoms are you experiencing?",
    "How old are you?",
    "What's your biological sex?",
    "Where are you located? (City, State, or ZIP code)",
    "How far are you willing to travel for a trial? (in miles)",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function extractEntities(text: string): ExtractedEntities {
    const out: ExtractedEntities = {};
    const lower = text.toLowerCase();
    // Condition heuristics
    const condMap = {
      "long covid": "long_covid",
      pasc: "long_covid",
      fibromyalgia: "fibromyalgia",
      hidradenitis: "hidradenitis_suppurativa",
      "hidradenitis suppurativa": "hidradenitis_suppurativa",
      hs: "hidradenitis_suppurativa",
      copd: "copd",
      alzheimer: "alzheimers_disease",
      alzheimers: "alzheimers_disease",
    };
    for (const [k, v] of Object.entries(condMap)) {
      if (lower.includes(k)) {
        out.condition = v;
        break;
      }
    }
    // Age
    const ageMatch = lower.match(/\b(\d{1,3})\b\s*(years old|yo|yrs|years)?/);
    if (ageMatch) {
      const n = parseInt(ageMatch[1], 10);
      if (!isNaN(n) && n > 0 && n < 120) out.age = n;
    }
    // ZIP (US 5-digit)
    const zipMatch = lower.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zipMatch) out.zip = zipMatch[1];
    // Remote preference
    if (/(remote|virtual|telehealth|from home)/.test(lower)) out.remote = true;
    if (/(in person|in-person|site visit|travel)/.test(lower)) out.remote = false;
    return out;
  }

  async function previewIfReady(found: ExtractedEntities) {
    const condition = found.condition || patientProfile.conditions?.[0];
    const age = found.age != null ? found.age : patientProfile.age;
    if (!condition || !age) return;
    const zip = found.zip || patientProfile.location?.zip || "";
    const remote = (found.remote != null ? found.remote : patientProfile.prefers_remote) || false;
    const key = `${condition}-${age}-${zip}-${remote ? 1 : 0}`;
    if (lastPreviewKeyRef.current === key) return;
    lastPreviewKeyRef.current = key;
    try {
      const body = {
        conditions: [condition],
        age,
        location: { country: "United States", zip },
        prefers_remote: remote,
      };
      const res = await fetch("/api/prefilter", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ patientProfile: body }),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({ trials: [] }));
      const count = Array.isArray(data.trials) ? data.trials.length : 0;
      const preview = count > 0
        ? `I already found ${count} promising trials so far based on condition and age.`
        : `I couldn't find trials yet; a couple more details may help.`;
      setMessages((prev) => {
        const previewMessage: Message = {
          id: prev.length + 1,
          type: "bot",
          content: preview,
          timestamp: new Date(),
        };
        return [...prev, previewMessage];
      });
    } catch { }
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userContent = inputValue;
    setMessages((prev) => {
      const userMessage: Message = {
        id: prev.length + 1,
        type: "user",
        content: userContent,
        timestamp: new Date(),
      };
      return [...prev, userMessage];
    });
    setInputValue("");
    setIsLoading(true);

    // Extract fields and update shared state
    try {
      const found = extractEntities(inputValue);
      const condition = found.condition;
      if (condition) {
        setPatientProfile((p) => ({ ...p, conditions: [condition] }));
      }
      if (found.age != null) {
        setPatientProfile((p) => ({ ...p, age: found.age }));
      }
      if (found.zip) {
        setPatientProfile((p) => ({ ...p, location: { ...(p.location || {}), zip: found.zip, country: p.location?.country || "United States" } }));
      }
      if (found.remote != null) {
        setPatientProfile((p) => ({ ...p, prefers_remote: found.remote }));
      }
      // Kick off early preview in background
      previewIfReady(found);
    } catch { }

    // Simulate bot response
    setTimeout(() => {
      setMessages((prev) => {
        const botResponse: Message = {
          id: prev.length + 1,
          type: "bot",
          content: `Thank you for sharing that. ${questions[currentStep] || "Let me analyze your information to find relevant trials."}`,
          timestamp: new Date(),
        };
        return [...prev, botResponse];
      });
      setIsLoading(false);

      if (currentStep < questions.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        // Complete the flow
        setTimeout(() => {
          onShortlist([{
            nct_id: "demo-001",
            title: "Long COVID Fatigue Study",
            sponsor: "Demo Sponsor",
            phase: "Phase 2",
            status: "Recruiting",
            condition_slugs: ["long_covid"],
            original_conditions: ["Long COVID"],
            criteria_json: {},
            site_count: 5,
            distance_km: 25,
            why: ["Condition matches", "Age in range", "Location nearby"]
          }]);
        }, 1000);
      }
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  function nextWizardStep() {
    const hasCondition = (patientProfile.conditions || []).length > 0;
    const hasAge = !!patientProfile.age;
    const hasSex = !!patientProfile.sex;
    const hasZip = !!patientProfile.location?.zip;
    if (!hasCondition) return "condition";
    if (!hasAge) return "age";
    if (!hasSex) return "sex";
    if (!hasZip) return "location";
    return "exclusions";
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Chat Messages */}
      <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.type === "user" ? "justify-end" : "justify-start"
              }`}
          >
            {message.type === "bot" && (
              <div className="w-8 h-8 rounded-full bg-pm-secondary/10 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-pm-secondary" />
              </div>
            )}
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${message.type === "user"
                  ? "bg-pm-primary text-white ml-auto"
                  : "bg-pm-bg/50 border border-pm-border/60"
                }`}
            >
              <p className="text-sm">{message.content}</p>
              <span className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {message.type === "user" && (
              <div className="w-8 h-8 rounded-xl bg-pm-primary/10 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-pm-primary" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-pm-secondary/10 flex items-center justify-center">
              <Bot size={16} className="text-pm-secondary" />
            </div>
            <div className="bg-pm-bg/50 border border-pm-border/60 px-4 py-2 rounded-2xl">
              <Loader2 size={16} className="animate-spin text-pm-muted" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <section className="mt-6 bg-white border border-pm-border rounded-2xl p-6 shadow-soft">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="mt-2 w-full rounded-2xl border border-pm-border p-4 focus:outline-none focus:ring-2 focus:ring-pm-primary/40"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="rounded-xl bg-pm-primary text-white px-5 py-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
      </section>

      {/* Quick Actions */}
      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-medium text-pm-ink">Quick actions:</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setInputValue("I have Long COVID symptoms")}
            className="rounded-full border border-pm-border px-5 py-2 hover:bg-white/70 text-sm"
          >
            Long COVID
          </button>
          <button
            onClick={() => setInputValue("I have fibromyalgia")}
            className="rounded-full border border-pm-border px-5 py-2 hover:bg-white/70 text-sm"
          >
            Fibromyalgia
          </button>
          <button
            onClick={() => setInputValue("I have hidradenitis suppurativa")}
            className="rounded-full border border-pm-border px-5 py-2 hover:bg-white/70 text-sm"
          >
            HS
          </button>
        </div>
        <a
          href="/trials"
          className="inline-block rounded-full border border-pm-border px-5 py-2 hover:bg-white/70 text-sm"
        >
          Use Quick Screening
        </a>
      </div>

      {/* Progress Indicator */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-sm text-pm-muted mb-2">
          <span>Progress</span>
          <span>{currentStep + 1} of {questions.length}</span>
        </div>
        <div className="w-full bg-pm-bg/50 rounded-full h-2">
          <div
            className="bg-pm-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 rounded-2xl border border-pm-border p-4">
        <h3 className="font-medium text-pm-ink mb-2">What we&apos;ve learned:</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-pm-muted">Condition:</span>
            <span className="text-pm-ink">{patientProfile.conditions?.[0] || 'Not specified'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-pm-muted">Age:</span>
            <span className="text-pm-ink">{patientProfile.age || 'Not specified'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-pm-muted">Sex:</span>
            <span className="text-pm-ink">{patientProfile.sex || 'Not specified'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-pm-muted">Location:</span>
            <span className="text-pm-ink">{patientProfile.location?.zip || 'Nationwide'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-pm-muted">Travel:</span>
            <span className="text-pm-ink">{patientProfile.willingness_to_travel_miles || patientProfile.max_travel_miles || '50'} miles</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => onShortlist([{
            nct_id: "demo-001",
            title: "Long COVID Fatigue Study",
            sponsor: "Demo Sponsor",
            phase: "Phase 2",
            status: "Recruiting",
            condition_slugs: ["long_covid"],
            original_conditions: ["Long COVID"],
            criteria_json: {},
            site_count: 5,
            distance_km: 25,
            why: ["Condition matches", "Age in range", "Location nearby"]
          }])}
          className="rounded-xl bg-pm-primary text-white px-5 py-2 hover:opacity-90"
        >
          Find My Matches
        </button>
        <button
          onClick={() => setMessages([messages[0]])}
          className="rounded-full border border-pm-border px-5 py-2 hover:bg-white/70"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
