export type HeroSample = {
  id: string;
  title: string;
  location: string;
  conditionSlug: string;
  conditionLabel: string;
  bullets: [string, string, string];
  optionalChips?: string[];
};

export const heroSamples: HeroSample[] = [
  {
    id: "sample-diabetes",
    title: "Everyday diabetes movement program",
    location: "Hartford, CT · +2 sites",
    conditionSlug: "type_2_diabetes",
    conditionLabel: "Type 2 Diabetes",
    optionalChips: ["Hybrid", "12 weeks"],
    bullets: [
      "Adults 18–65 using oral diabetes medicines.",
      "Weekly ~45-min sessions with remote check-ins.",
      "Travel support may be available.",
    ],
  },
  {
    id: "sample-long-covid",
    title: "Remote recovery coaching",
    location: "Boston, MA",
    conditionSlug: "long_covid",
    conditionLabel: "Long COVID",
    optionalChips: ["Telehealth available", "8 weeks"],
    bullets: [
      "Adults with ongoing post-viral symptoms.",
      "Virtual 30-min sessions, twice weekly.",
      "Symptom tracking through a simple app.",
    ],
  },
  {
    id: "sample-migraine",
    title: "Migraine wearable pilot",
    location: "Providence, RI · +1 site",
    conditionSlug: "migraine",
    conditionLabel: "Migraine",
    optionalChips: ["In-person", "Biweekly visits"],
    bullets: [
      "Non-invasive neuromodulation wearable for relief.",
      "Biweekly coaching and symptom diary reminders.",
      "Travel reimbursement offered per visit.",
    ],
  },
  {
    id: "sample-copd",
    title: "At-home breathing program",
    location: "Cambridge, MA · +3 sites",
    conditionSlug: "copd",
    conditionLabel: "COPD",
    optionalChips: ["Hybrid", "10 weeks"],
    bullets: [
      "Adults with a COPD diagnosis.",
      "Home exercises with remote check-ins.",
      "Occasional clinic spirometry assessments.",
    ],
  },
  {
    id: "sample-osteoarthritis",
    title: "Joint pain activity study",
    location: "Somerville, MA · +2 sites",
    conditionSlug: "osteoarthritis",
    conditionLabel: "Osteoarthritis",
    optionalChips: ["In-person", "Monthly visits"],
    bullets: [
      "Adults with knee or hip osteoarthritis.",
      "Guided activity and education sessions.",
      "Routine assessments included.",
    ],
  },
  {
    id: "sample-insomnia",
    title: "Sleep routines coaching",
    location: "Boston, MA · Remote",
    conditionSlug: "insomnia",
    conditionLabel: "Insomnia",
    optionalChips: ["Telehealth", "6 weeks"],
    bullets: [
      "Trouble falling or staying asleep.",
      "Weekly virtual sessions and a sleep diary.",
      "Optional check-ins between visits.",
    ],
  },
  {
    id: "sample-obesity",
    title: "Metabolic wellness program",
    location: "Quincy, MA · +4 sites",
    conditionSlug: "obesity",
    conditionLabel: "Obesity",
    optionalChips: ["Hybrid", "16 weeks"],
    bullets: [
      "Adults working on weight management.",
      "Nutrition and activity guidance with coaching.",
      "Clinic labs at start and end.",
    ],
  },
  {
    id: "sample-anxiety",
    title: "Stress management app study",
    location: "Remote (U.S.)",
    conditionSlug: "anxiety",
    conditionLabel: "Anxiety",
    optionalChips: ["Remote", "8 weeks"],
    bullets: [
      "App-based daily exercises for anxiety.",
      "Optional weekly video check-ins.",
      "Short surveys to track progress.",
    ],
  },
];
