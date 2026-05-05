"use client";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, HelpCircle, Info } from "lucide-react";
import type { PatientProfile } from "@/shared/match/types";

type TrialSummary = {
  nct_id: string;
  title: string;
  sponsor?: string;
  phase?: string;
  min_age_years?: number | null;
  max_age_years?: number | null;
  original_conditions?: string[];
};

type ScreenerQuestion = {
  id: string;
  question: string;
  type: "boolean";
  required: boolean;
  help?: string;
};

type TrialScreenerProps = {
  trial: TrialSummary;
  patientProfile?: Partial<PatientProfile>;
  onBack: () => void;
};

export default function TrialScreener({ trial, patientProfile, onBack }: TrialScreenerProps) {
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(false);

  const questions: ScreenerQuestion[] = [
    {
      id: "age_check",
      question: `Are you between ${trial?.min_age_years || 18} and ${trial?.max_age_years || 75} years old?`,
      type: "boolean",
      required: true,
      help: "This trial requires participants to be within this age range."
    },
    {
      id: "diagnosis",
      question: `Have you been diagnosed with ${trial?.original_conditions?.[0] || "the condition"} by a healthcare provider?`,
      type: "boolean",
      required: true,
      help: "A formal diagnosis is required for this study."
    },
    {
      id: "symptoms",
      question: "Do you experience symptoms that interfere with daily activities?",
      type: "boolean",
      required: false,
      help: "This helps determine if your symptoms match the study criteria."
    }
  ];

  const handleAnswer = (questionId: string, value: boolean) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // For now, just go back to shortlist
      onBack();
    } catch (error) {
      console.error("Error completing screener:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentQ = questions[currentQuestion];
  const hasAnswered = answers[currentQ?.id] !== undefined;
  const isRequired = currentQ?.required;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header with back button */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-pm-muted hover:text-pm-secondary transition-colors"
        >
          ← Back to results
        </button>
        <h2 className="text-xl font-semibold text-pm-ink">Trial Screening</h2>
      </div>
      
      {/* Trial Info */}
      {trial && (
        <div className="mb-6 p-4 bg-pm-bg/30 rounded-xl border border-pm-border/30">
          <h3 className="font-medium text-pm-ink mb-1">{trial.title}</h3>
          <p className="text-sm text-pm-muted">{trial.sponsor} • {trial.phase}</p>
        </div>
      )}
      
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-pm-muted mb-2">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
          <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}%</span>
        </div>
        <div className="w-full bg-pm-bg/50 rounded-full h-2">
          <div
            className="bg-pm-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white border border-pm-border/60 rounded-2xl p-6 shadow-soft mb-6">
        <div className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-pm-primary/10 text-pm-primary flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium">{currentQuestion + 1}</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-pm-ink mb-2">{currentQ.question}</h3>
            {currentQ.help && (
              <div className="flex items-start gap-2 text-sm text-pm-muted">
                <Info size={16} className="mt-0.5 flex-shrink-0" />
                <p>{currentQ.help}</p>
              </div>
            )}
          </div>
        </div>

        {/* Answer Options */}
        <div className="space-y-3">
          <button
            onClick={() => handleAnswer(currentQ.id, true)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
              answers[currentQ.id] === true
                ? "border-pm-primary bg-pm-primary/5 text-pm-primary"
                : "border-pm-border/60 hover:border-pm-secondary/40 hover:bg-pm-bg/50"
            }`}
          >
            <CheckCircle size={20} className={answers[currentQ.id] === true ? "text-pm-primary" : "text-pm-muted"} />
            <span className="font-medium">Yes</span>
          </button>

          <button
            onClick={() => handleAnswer(currentQ.id, false)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 ${
              answers[currentQ.id] === false
                ? "border-pm-primary bg-pm-primary/5 text-pm-primary"
                : "border-pm-border/60 hover:border-pm-secondary/40 hover:bg-pm-bg/50"
            }`}
          >
            <XCircle size={20} className={answers[currentQ.id] === false ? "text-pm-primary" : "text-pm-muted"} />
            <span className="font-medium">No</span>
          </button>
        </div>

        {/* Help Text */}
        {currentQ.help && (
          <div className="mt-4 p-3 bg-pm-bg/30 rounded-lg border border-pm-border/30">
            <div className="flex items-start gap-2">
              <HelpCircle size={16} className="text-pm-secondary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-pm-muted">{currentQ.help}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
          disabled={currentQuestion === 0}
          className="px-4 py-2 text-pm-muted hover:text-pm-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        <button
          onClick={handleNext}
          disabled={!hasAnswered || loading}
                      className="rounded-xl bg-pm-primary text-white px-6 py-3 font-medium hover:bg-pm-primary/90 transition-all duration-200 shadow-soft hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : currentQuestion === questions.length - 1 ? "Complete Screening" : "Next"}
        </button>
      </div>

      {/* Summary */}
      <div className="mt-8 p-4 bg-pm-bg/30 rounded-xl border border-pm-border/30">
        <h4 className="font-medium text-pm-ink mb-3">Your Answers:</h4>
        <div className="space-y-2 text-sm">
          {questions.map((q, index) => (
            <div key={q.id} className="flex items-center justify-between">
              <span className="text-pm-muted">{q.question.substring(0, 30)}...</span>
              <span className={`font-medium ${answers[q.id] === true ? "text-green-600" : answers[q.id] === false ? "text-red-600" : "text-pm-muted"}`}>
                {answers[q.id] === true ? "Yes" : answers[q.id] === false ? "No" : "Not answered"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
