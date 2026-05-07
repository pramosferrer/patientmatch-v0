import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "How does PatientMatch work?",
    answer: "PatientMatch uses AI to analyze your health profile and match you with relevant clinical trials. We screen you against trial criteria to find studies you&apos;re most likely to qualify for."
  },
  {
    question: "Is my information private?",
    answer: "PatientMatch is designed to work without collecting contact information. Matching details stay in your browser where possible, and we do not send your information to trial sites."
  },
  {
    question: "How accurate are the matches?",
    answer: "Our matching algorithm analyzes trial criteria against your profile to provide confidence scores. &apos;Likely match&apos; means you meet most requirements, while &apos;Possible&apos; indicates some criteria need verification."
  },
  {
    question: "What happens after I find a trial?",
    answer: "You can complete a detailed screener, save or share the summary, and review the official ClinicalTrials.gov listing. PatientMatch does not contact sites on your behalf."
  },
  {
    question: "Are there costs to participate?",
    answer: "Most clinical trials cover the cost of treatment and may provide compensation for your time and travel. The specific details vary by trial and are explained in the official listing or by the study team."
  },
  {
    question: "Can I participate in multiple trials?",
    answer: "It depends on the specific trials and your health condition. Some trials allow participation in other studies, while others have restrictions. Always discuss this with your clinician or the study team."
  }
];

export default function FAQPage() {
  return (
    <main className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-heading tracking-tightish leading-tight text-3xl text-pm-ink font-bold flex items-center gap-2 justify-center">
            <HelpCircle className="h-7 w-7 text-pm-secondary" />
            Frequently Asked Questions
          </h1>
          <p className="text-pm-body mt-4 text-lg">Everything you need to know about finding and participating in clinical trials</p>
        </div>

        {/* FAQ List */}
        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="rounded-2xl border border-pm-border/60 bg-white shadow-soft">
              <details className="group">
                <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-pm-bg/30 transition-colors rounded-t-2xl">
                  <h3 className="text-lg font-semibold text-pm-ink pr-4">{faq.question}</h3>
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-pm-muted transition-transform group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </summary>
                <div className="px-6 pb-6">
                  <p className="text-pm-body leading-relaxed">{faq.answer}</p>
                </div>
              </details>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <div className="bg-pm-bg/50 border border-pm-border/60 rounded-2xl p-8">
            <h2 className="font-heading text-2xl font-semibold text-pm-ink mb-4">Ready to find your match?</h2>
            <p className="text-pm-body mb-6">Start your journey to finding relevant clinical trials in just a few minutes.</p>
            <a
              href="/trials"
              className="inline-flex items-center rounded-xl bg-pm-primary text-white px-8 py-3 text-lg font-medium hover:bg-pm-primaryHover transition-colors shadow-soft hover:shadow-lg"
            >
              Find My Match
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
