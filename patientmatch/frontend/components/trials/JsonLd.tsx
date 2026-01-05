'use client';

import React from 'react';

interface Trial {
  nct_id: string;
  title: string;
  phase?: string | null;
  status?: string | null;
  status_bucket?: string | null;
  sponsor?: string | null;
  trial_url?: string;
  ctgov_url?: string;
}

interface JsonLdProps {
  trials: Trial[];
}

export default function JsonLd({ trials }: JsonLdProps) {
  if (!trials || trials.length === 0) {
    return null;
  }

  const jsonLd = trials.map(trial => ({
    "@context": "https://schema.org",
    "@type": "MedicalStudy",
    "name": trial.title,
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "NCT",
      "value": trial.nct_id
    },
    "sponsor": trial.sponsor ? {
      "@type": "Organization",
      "name": trial.sponsor
    } : undefined,
    "studyDesign": trial.phase ? {
      "@type": "MedicalStudyDesign",
      "name": trial.phase
    } : undefined,
    "status": (trial.status ?? trial.status_bucket) ? {
      "@type": "MedicalStudyStatus",
      "name": trial.status ?? trial.status_bucket
    } : undefined,
    "url": trial.trial_url || `https://clinicaltrials.gov/study/${trial.nct_id}`,
    "sameAs": trial.ctgov_url || `https://clinicaltrials.gov/study/${trial.nct_id}`
  })).filter(Boolean);

  // Limit payload size to prevent performance issues
  const limitedJsonLd = jsonLd.slice(0, 20); // Max 20 trials per page

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(limitedJsonLd)
      }}
    />
  );
}
