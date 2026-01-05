"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { logEvent } from '@/lib/analytics';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";

const leadFormSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  zip_code: z.string().optional(),
  consent: z.boolean().refine(val => val === true, {
    message: "You must consent to share your information"
  })
});

type LeadFormData = z.infer<typeof leadFormSchema>;

type LeadFormProps = {
  nct_id: string;
  trial_title: string;
  condition?: string;
  match_result: 'qualifies' | 'not_qualified' | 'possible';
  answers_json: any;
  onSubmitted?: (id: string) => void;
};

export default function LeadForm({ 
  nct_id, 
  trial_title, 
  condition, 
  match_result, 
  answers_json, 
  onSubmitted 
}: LeadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      zip_code: "",
      consent: false
    }
  });

  const onSubmit = async (data: LeadFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!consentChecked) {
        setSubmitError('Please consent to proceed.');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        trial_nct_id: nct_id,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone || null,
        has_user_consent: true,
        prefill: {
          trial_title,
          condition,
          match_result,
          answers_json,
          zip_code: data.zip_code || null,
        }
      };

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit information');
      }

      if (result.ok && result.id) {
        setLeadId(result.id);
        setIsSubmitted(true);
        onSubmitted?.(result.id);
        try {
          const email = form.getValues('email') || '';
          await logEvent('lead_submitted', { nct_id, match_result, email_domain: email.split('@')[1] ?? null });
        } catch {}
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit information');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-green-700">
                Thank you for your interest!
              </h3>
              <p className="text-muted-foreground">
                We’ve received your information and will be in touch soon to discuss next steps.
              </p>
              <p className="text-xs text-muted-foreground">
                Reference ID: {leadId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Share Your Information</CardTitle>
        <p className="text-sm text-muted-foreground">
          Please provide your contact details so the research team can reach out to you.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="full_name"
              {...form.register("full_name")}
              placeholder="Enter your full name"
              className={form.formState.errors.full_name ? "border-red-500" : ""}
            />
            {form.formState.errors.full_name && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {form.formState.errors.full_name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              placeholder="Enter your email address"
              className={form.formState.errors.email ? "border-red-500" : ""}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              {...form.register("phone")}
              placeholder="Enter your phone number (optional)"
            />
          </div>

          {/* ZIP Code */}
          <div className="space-y-2">
            <Label htmlFor="zip_code">ZIP Code</Label>
            <Input
              id="zip_code"
              {...form.register("zip_code")}
              placeholder="Enter your ZIP code (optional)"
              maxLength={10}
            />
          </div>

          {/* Consent */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="consent"
                checked={form.watch("consent")}
                onCheckedChange={(checked) => form.setValue("consent", checked === true)}
                className={form.formState.errors.consent ? "border-red-500" : ""}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="consent" className="text-sm font-medium leading-none">
                  I agree to be contacted about this trial
                </Label>
                {form.formState.errors.consent && (
                  <p className="text-xs text-red-600">
                    You must consent to proceed.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {submitError}
              </p>
            </div>
          )}

          {/* Consent */}
          <div className="space-y-2">
            <label className="text-sm flex items-start gap-2">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5"
                required
              />
              <span>
                I consent to PatientMatch storing my information and sharing it with clinical trial sites as described in the{' '}
                <a href="/privacy" className="underline" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              We protect your information using encryption and secure storage. Your details are only shared with trial sites you choose.
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              type="submit" 
              disabled={isSubmitting || !consentChecked}
              variant="brand"
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Share My Information"
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Your information will be shared securely and only with the research team for this specific trial.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
