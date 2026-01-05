import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "How does PatientMatch work?",
    answer: "PatientMatch uses AI to analyze your health profile and match you with relevant clinical trials. We screen you against trial criteria to find studies you&apos;re most likely to qualify for."
  },
  {
    question: "Is my information private?",
    answer: "Yes, absolutely. We never share your personal information with trial sites unless you explicitly choose to connect. Your data is encrypted and stored securely following HIPAA guidelines."
  },
  {
    question: "How accurate are the matches?",
    answer: "Our matching algorithm analyzes trial criteria against your profile to provide confidence scores. &apos;Likely match&apos; means you meet most requirements, while &apos;Possible&apos; indicates some criteria need verification."
  },
  {
    question: "What happens after I find a trial?",
    answer: "Once you find a trial you&apos;re interested in, you can complete a detailed screener. If you qualify, we&apos;ll connect you with the research site to discuss participation."
  },
  {
    question: "Are there costs to participate?",
    answer: "Most clinical trials cover the cost of treatment and may provide compensation for your time and travel. The specific details vary by trial and will be explained by the research team."
  },
  {
    question: "Can I participate in multiple trials?",
    answer: "It depends on the specific trials and your health condition. Some trials allow participation in other studies, while others have restrictions. Always discuss this with the research team."
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
              href="/match" 
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

