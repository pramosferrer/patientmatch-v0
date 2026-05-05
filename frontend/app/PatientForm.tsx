'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type FormData = {
  patient_age: number;
  patient_diagnosis_namd: string;
  patient_condition_glaucoma: string;
  patient_treatment_antivegf: string;
  patient_history_infection: string;
  patient_history_uveitis: string;
  patient_use_corticosteroids: string;
  patient_history_genetherapy: string;
  name: string;
  email: string;
  phone: string;
};

type Question =
  | { name: keyof FormData; label: string; type: 'number' }
  | { name: keyof FormData; label: string; type: 'select'; options: string[] };

export default function PatientForm() {
  const [formStep, setFormStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    patient_age: 50,
    patient_diagnosis_namd: 'yes',
    patient_condition_glaucoma: 'no',
    patient_treatment_antivegf: 'yes',
    patient_history_infection: 'no',
    patient_history_uveitis: 'no',
    patient_use_corticosteroids: 'no',
    patient_history_genetherapy: 'no',
    name: '',
    email: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [finalStatus, setFinalStatus] = useState<'success' | 'fail' | null>(null);

  const questions: Question[] = [
    { name: 'patient_age', label: 'What is your age?', type: 'number' },
    { name: 'patient_diagnosis_namd', label: 'Have you been diagnosed by a doctor with wet AMD?', type: 'select', options: ['yes', 'no'] },
    { name: 'patient_condition_glaucoma', label: 'Do you have active, uncontrolled glaucoma?', type: 'select', options: ['no', 'yes'] },
    { name: 'patient_treatment_antivegf', label: 'Are you currently receiving anti-VEGF treatment?', type: 'select', options: ['yes', 'no'] },
    { name: 'patient_history_infection', label: 'In the last 6 months, have you had an active eye infection?', type: 'select', options: ['no', 'yes'] },
    { name: 'patient_history_uveitis', label: 'Do you have a history of uveitis?', type: 'select', options: ['no', 'yes'] },
    { name: 'patient_use_corticosteroids', label: 'Have you used corticosteroid eye drops or injections in the last 3 months?', type: 'select', options: ['no', 'yes'] },
    { name: 'patient_history_genetherapy', label: 'Have you ever received gene therapy treatment?', type: 'select', options: ['no', 'yes'] },
  ];

  const handleChange = <K extends keyof FormData>(name: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleScreeningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Send only screening data for the initial check
    const screeningData = (({ name, email, phone, ...rest }) => rest)(formData);

    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(screeningData),
      });
      const result = await response.json();
      if (result.is_match) {
        setFormStep(formStep + 1); // Go to contact form
      } else {
        setFinalStatus('fail'); // Go to final "no match" message
      }
    } catch (error) {
      console.error("Screening error:", error);
    }
    setIsLoading(false);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Send the FULL data object to be saved
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setFinalStatus('success'); // Go to final "success" message
      }
    } catch (error) {
      console.error("Lead submission error:", error);
    }
    setIsLoading(false);
  };

  const renderFormContent = () => {
    if (finalStatus) {
      return (
        <div className="text-center py-8">
          <p className={`text-lg ${finalStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {finalStatus === 'success' 
              ? '✅ Thank you! Your information has been securely submitted.'
              : '❌ Based on your answers, you are not a likely match for this specific trial.'
            }
          </p>
        </div>
      );
    }

    if (formStep <= questions.length) {
      const q = questions[formStep - 1];
      return (
        <form onSubmit={formStep === questions.length ? handleScreeningSubmit : (e) => {e.preventDefault(); setFormStep(formStep + 1)}}>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor={q.name}>{q.label}</Label>
              {q.type === 'number' ? (
                <Input
                  type="number"
                  id={q.name}
                  value={formData[q.name]}
                  onChange={(e) => handleChange(q.name, Number(e.target.value))}
                  required
                />
              ) : (
                <Select value={String(formData[q.name] ?? '')} onValueChange={(value) => handleChange(q.name, value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {q.options.map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </form>
      );
    }

    if (formStep > questions.length) {
      return (
        <form onSubmit={handleLeadSubmit}>
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">You may be a good fit!</h2>
              <p className="text-gray-600">Please provide your contact information. The study coordinator will contact you to discuss the next steps.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  required
                />
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox id="privacy-consent" required />
                <Label htmlFor="privacy-consent" className="text-sm leading-relaxed">
                  I have read the{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </a>
                  {' '}and understand that PatientMatch no longer sends patient contact information to trial sites.
                </Label>
              </div>
            </div>
          </div>
        </form>
      );
    }
  };

  const renderFooter = () => {
    if (finalStatus) {
      return null;
    }

    if (formStep <= questions.length) {
      return (
        <div className="flex justify-between">
          {formStep > 1 && (
            <Button variant="outline" onClick={() => setFormStep(formStep - 1)}>
              Back
            </Button>
          )}
          {formStep < questions.length ? (
            <Button onClick={() => setFormStep(formStep + 1)} className="ml-auto">
              Next
            </Button>
          ) : (
            <Button onClick={handleScreeningSubmit} disabled={isLoading} className="ml-auto">
              {isLoading ? 'Checking...' : 'Check Eligibility'}
            </Button>
          )}
        </div>
      );
    }

    if (formStep > questions.length) {
      return (
        <Button onClick={handleLeadSubmit} disabled={isLoading} className="w-full">
          {isLoading ? 'Submitting...' : 'Submit Information'}
        </Button>
      );
    }
  };

  const progressValue = finalStatus ? 100 : (formStep / (questions.length + 1)) * 100;

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-center">Screening Questions</h1>
            <Progress value={progressValue} className="w-full" />
          </div>
        </CardHeader>
        <CardContent>
          {renderFormContent()}
        </CardContent>
        <CardFooter>
          {renderFooter()}
        </CardFooter>
      </Card>
    </div>
  );
}
