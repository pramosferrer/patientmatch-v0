'use client';

import { useState } from 'react';
import { z } from 'zod';
import ConditionSelect from '@/components/ConditionSelect';
import { CONDITION_SLUGS } from '@/shared/conditions';
import { Button as UIButton } from '@/components/ui/button';
import { Input as UIInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import Toast from '@/components/Toast';

const schema = z.object({
  physician_name: z.string().min(2),
  physician_email: z.string().email(),
  organization: z.string().optional(),
  npi: z.string().optional(),
  patient_first: z.string().optional(),
  patient_email: z.string().email().optional(),
  patient_phone: z.string().optional(),
  patient_zip: z.string().min(5).max(10),
  condition: z.enum(CONDITION_SLUGS),
  notes: z.string().optional(),
  has_patient_consent: z.literal(true),
});

export default function ReferPage() {
  // TS shim for JS-based UI component
  const InputAny: any = UIInput as any;
  const ButtonAny: any = UIButton as any;
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  async function onSubmit(formData: FormData) {
    setLoading(true);
    const payload = Object.fromEntries(formData.entries());
    try {
      const parsed = schema.parse({
        ...payload,
        has_patient_consent: payload.has_patient_consent === 'on' ? true : payload.has_patient_consent === 'true',
      });
      const res = await fetch('/api/refer', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(parsed) });
      setOk(res.ok);
    } catch (e) {
      console.error(e);
      addToast('Please check the form fields and try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-heading tracking-tightish leading-tight text-4xl md:text-5xl text-pm-ink font-bold mb-4">Refer a Patient to a Trial</h1>
        <p className="text-pm-body text-lg leading-relaxed mb-8">2 minutes. We&apos;ll pre-screen and share options fast.</p>
        
        {!ok ? (
          <div className="pm-card p-8">
            <form action={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Physician name</Label>
                  <InputAny name="physician_name" required className="w-full" />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Email</Label>
                  <InputAny name="physician_email" type="email" required className="w-full" />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Organization</Label>
                  <InputAny name="organization" className="w-full" />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">NPI (optional)</Label>
                  <InputAny name="npi" className="w-full" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Patient first name or initials</Label>
                  <InputAny name="patient_first" className="w-full" />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Patient email (optional)</Label>
                  <InputAny name="patient_email" type="email" className="w-full" />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Patient phone (optional)</Label>
                  <InputAny name="patient_phone" className="w-full" />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Patient ZIP</Label>
                  <InputAny name="patient_zip" required className="w-full" />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Condition</Label>
                <ConditionSelect name="condition" defaultValue="long_covid" />
              </div>

              <div>
                <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Notes</Label>
                <textarea
                  name="notes"
                  placeholder="Brief clinical context (optional)"
                  className="flex w-full rounded-lg border border-pm-sky/20 bg-white px-4 py-3 text-base placeholder:text-pm-body/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pm-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-24"
                />
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" name="has_patient_consent" required className="rounded border-pm-sky/20 text-pm-accent focus:ring-pm-ring" />
                <Label className="text-sm font-medium leading-none text-pm-ink">I have patient permission to share this referral.</Label>
              </div>

              <ButtonAny 
                disabled={loading} 
                type="submit" 
                className="w-full bg-pm-accent hover:bg-pm-accentHover text-white px-6 py-3 text-lg font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-ring"
              >
                {loading ? 'Submitting...' : 'Submit referral'}
              </ButtonAny>
            </form>
          </div>
        ) : (
          <div className="pm-card p-8 text-center">
            <h2 className="font-heading text-pm-ink text-2xl font-semibold mb-4">Thank you!</h2>
            <p className="text-pm-body text-lg">We&apos;ll review and follow up within 24 hours.</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}


