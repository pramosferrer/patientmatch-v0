# Public Interest Goals

PatientMatch is an open-source project focused on making clinical trial information easier for patients and caregivers to understand.

Clinical trial registries are public, but they are not always easy to use. Patients often need to answer practical questions before they can have a productive conversation with a clinician or study team:

- Is this study recruiting?
- Are there nearby sites?
- Does the study appear relevant to the condition I am researching?
- What screening questions should I expect?
- What should I ask my doctor or the trial team next?

PatientMatch focuses on the patient-facing layer of that workflow. The project does not make eligibility decisions or provide medical advice. It provides reusable software patterns for trial discovery, patient-readable trial cards, structured questionnaire rendering, and privacy-conscious profile handling.

## Why Open Source Matters

Trial access work benefits from being inspectable. Patient advocates, researchers, clinics, and developers should be able to review how trial information is presented, improve accessibility, test patient-facing language, and adapt the storefront to different conditions or communities.

This repository makes the following pieces reusable:

- A Next.js App Router storefront for clinical trial discovery.
- Trial list, detail, comparison, and screening UI patterns.
- A direct-injection questionnaire adapter from `questionnaire_json` to patient-facing questions.
- Supabase anon-read serving contracts for public trial, site, and ZIP centroid data.
- Privacy and contribution guardrails for healthcare-adjacent open-source work.

## Boundaries

This repository is the storefront. It does not contain ClinicalTrials.gov ingestion, AACT processing, criteria parsing, PMQ generation, or service-role data loading scripts. Keeping those workflows outside the storefront helps preserve a clearer runtime boundary for public patient-facing code.
