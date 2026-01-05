'use client';

import { useState } from 'react';
import { z } from 'zod';
import { Button as UIButton } from '@/components/ui/button';
import { Input as UIInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  org_name: z.string().min(2),
  contact_name: z.string().min(2),
  contact_email: z.string().email(),
  role: z.string().optional(),
  conditions: z.string().min(2), // comma-separated list
  phase: z.string().optional(),
  description_plain: z.string().min(10),
  sites: z
    .array(
      z.object({
        site_name: z.string().min(2, 'Required'),
        city: z.string().min(2, 'Required'),
        state: z.string().min(2, 'Required'),
        zip: z.string().regex(/^[0-9A-Za-z -]{3,10}$/, 'Enter a valid ZIP/Postal'),
      })
    )
    .min(1, 'Add at least one site'),
  travel_stipend: z.enum(['yes','no','unsure']),
  visit_model: z.enum(['on_site','hybrid','remote']),
  inclusion_text: z.string().optional(),
  exclusion_text: z.string().optional(),
  contact_method: z.enum(['email','webhook']).default('email'),
  webhook_url: z.string().url().optional(),
}).superRefine((val, ctx) => {
  if (val.contact_method === 'webhook' && !val.webhook_url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Webhook URL is required for webhook contact method', path: ['webhook_url'] });
  }
});

export default function ListTrialPage() {
  // TS shims for JS-based UI components
  const InputAny: any = UIInput as any;
  const ButtonAny: any = UIButton as any;

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [sites, setSites] = useState([{ site_name: '', city: '', state: '', zip: '' }]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function updateSite(index: number, field: 'site_name'|'city'|'state'|'zip', value: string) {
    setSites(prev => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }
  function addSite() {
    setSites(prev => [...prev, { site_name: '', city: '', state: '', zip: '' }]);
  }
  function removeSite(index: number) {
    setSites(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setErrorMsg(null);
    const payload = Object.fromEntries(formData.entries());
    const body = { ...payload, sites } as any;
    try {
      const parsed = schema.parse({
        ...body,
        travel_stipend: String(body.travel_stipend),
        visit_model: String(body.visit_model),
        contact_method: String(body.contact_method || 'email'),
      });
      const res = await fetch('/api/list-trial', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(parsed) });
      setOk(res.ok);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.errors?.[0]?.message || 'Please check the fields.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-heading tracking-tightish leading-tight text-4xl md:text-5xl text-pm-ink font-bold mb-4">List Your Trial — Get Qualified Patients</h1>
          <p className="text-pm-body text-lg leading-relaxed">Help patients find your clinical trial and get pre-screened participants</p>
        </div>
        
        {!ok ? (
          <div className="pm-card p-8">
            <form action={onSubmit} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Organization</Label>
                  <InputAny name="org_name" required className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Contact name</Label>
                  <InputAny name="contact_name" required className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Email</Label>
                  <InputAny name="contact_email" type="email" required className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Role</Label>
                  <InputAny name="role" className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Condition(s)</Label>
                  <InputAny name="conditions" placeholder="e.g., fibromyalgia, long covid" required className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Phase</Label>
                  <InputAny name="phase" placeholder="I/II/III/IV" className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Plain-language description</Label>
                <textarea
                  name="description_plain"
                  required
                  className="flex w-full rounded-lg border border-pm-sky/20 bg-white px-4 py-3 text-base placeholder:text-pm-body/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pm-ring focus-visible:border-pm-accent transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 min-h-24"
                />
              </div>

              <div className="space-y-6">
                <div className="flex items-baseline justify-between">
                  <Label className="text-sm font-medium leading-none text-pm-ink">Sites</Label>
                  <span className="text-xs text-pm-body/70">We use this to route patients to the closest site.</span>
                </div>
                <div className="space-y-4">
                  {sites.map((site, idx) => (
                    <div key={idx} className="group rounded-xl border border-pm-sky/20 bg-white p-6 shadow-soft transition-all duration-200 hover:shadow-lg hover:border-pm-accent/20">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-pm-body/70 font-medium">Site name</Label>
                          <InputAny value={site.site_name} onChange={(e: any) => updateSite(idx, 'site_name', e.target.value)} placeholder="Mass General" className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
                        </div>
                        <div>
                          <Label className="text-xs text-pm-body/70 font-medium">City</Label>
                          <InputAny value={site.city} onChange={(e: any) => updateSite(idx, 'city', e.target.value)} placeholder="Boston" className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
                        </div>
                        <div>
                          <Label className="text-xs text-pm-body/70 font-medium">State/Province</Label>
                          <InputAny value={site.state} onChange={(e: any) => updateSite(idx, 'state', e.target.value)} placeholder="MA" className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
                        </div>
                        <div>
                          <Label className="text-xs text-pm-body/70 font-medium">ZIP/Postal</Label>
                          <InputAny value={site.zip} onChange={(e: any) => updateSite(idx, 'zip', e.target.value)} placeholder="02114" className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
                        </div>
                      </div>
                      <div className="flex justify-end mt-4 pt-3 border-t border-pm-sky/20">
                        <ButtonAny 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => removeSite(idx)} 
                          disabled={sites.length === 1}
                          className="hover:border-pm-accent/40 hover:text-pm-accent transition-colors duration-200"
                        >
                          Remove
                        </ButtonAny>
                      </div>
                    </div>
                  ))}
                </div>
                <ButtonAny 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  onClick={addSite}
                  className="hover:bg-pm-sky/20 hover:border-pm-accent/40 transition-all duration-200"
                >
                  Add site
                </ButtonAny>
                {errorMsg ? <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{errorMsg}</p> : null}
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Travel stipend</Label>
                  <select className="w-full border border-pm-sky/20 rounded-lg p-3 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" name="travel_stipend" defaultValue="unsure">
                    <option value="yes">Yes</option><option value="no">No</option><option value="unsure">Unsure</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Visit model</Label>
                  <select className="w-full border border-pm-sky/20 rounded-lg p-3 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" name="visit_model" defaultValue="on_site">
                    <option value="on_site">On-site only</option><option value="hybrid">Hybrid</option><option value="remote">Fully remote</option>
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Contact method</Label>
                  <select className="w-full border border-pm-sky/20 rounded-lg p-3 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" name="contact_method" defaultValue="email">
                    <option value="email">Email</option><option value="webhook">Webhook</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Webhook URL (if selected)</Label>
                <InputAny name="webhook_url" placeholder="https://example.com/intake" className="w-full border-pm-sky/20 focus:border-pm-accent focus:ring-2 focus:ring-pm-ring transition-all duration-200" />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Key inclusion bullets</Label>
                  <textarea
                    name="inclusion_text"
                    placeholder="- Diagnosed within 12 months..."
                    className="flex w-full rounded-lg border border-pm-sky/20 bg-white px-4 py-3 text-base placeholder:text-pm-body/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pm-ring focus-visible:border-pm-accent transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 min-h-24"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium leading-none text-pm-ink mb-2 block">Key exclusion bullets</Label>
                  <textarea
                    name="exclusion_text"
                    placeholder="- On X medication..."
                    className="flex w-full rounded-lg border border-pm-sky/20 bg-white px-4 py-3 text-base placeholder:text-pm-body/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pm-ring focus-visible:border-pm-accent transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 min-h-24"
                  />
                </div>
              </div>

              <ButtonAny 
                disabled={loading} 
                type="submit"
                className="w-full bg-pm-accent hover:bg-pm-accentHover text-white py-4 text-lg font-medium shadow-soft hover:shadow-lg transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-ring"
              >
                {loading ? 'Submitting...' : 'Submit trial'}
              </ButtonAny>
            </form>
          </div>
        ) : (
          <div className="pm-card p-8 text-center">
            <h2 className="font-heading text-pm-ink text-2xl font-semibold mb-4">Thanks!</h2>
            <p className="text-pm-body text-lg">We&apos;ll be in touch to verify details and start sending pre‑screened patients.</p>
          </div>
        )}
      </div>
    </div>
  );
}


