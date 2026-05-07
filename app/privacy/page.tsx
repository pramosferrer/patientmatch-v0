import { Shield, EyeOff, Database, Lock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <main className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="bg-white rounded-2xl border border-pm-border/60 p-6 md:p-8 shadow-soft mb-8">
          <h1 className="font-heading tracking-tightish leading-tight text-4xl md:text-5xl text-pm-ink font-bold">Privacy Policy</h1>
          <p className="text-pm-body mt-4 text-lg">
            PatientMatch is designed for private trial discovery. We avoid collecting contact information,
            do not send patient details to trial sites, and explain public trial data so you can prepare
            better questions.
          </p>
        </header>

        {/* Privacy Principles */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="rounded-lg border-pm-border/60 shadow-pm">
            <CardHeader>
              <div className="flex items-center gap-3 text-pm-secondary">
                <Shield size={24} />
                <CardTitle className="text-lg">Not a Medical Provider</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-pm-body text-sm leading-relaxed">
                PatientMatch is an educational trial discovery tool, not a medical provider or study site.
                Final eligibility decisions come from the study team.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-pm-border/60 shadow-pm">
            <CardHeader>
              <div className="flex items-center gap-3 text-pm-secondary">
                <EyeOff size={24} />
                <CardTitle className="text-lg">Anonymous Screening</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-pm-body text-sm leading-relaxed">
                You can screen for trials without providing your name, email, or phone number. We do not
                collect or send patient leads to trial sites.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-pm-border/60 shadow-pm">
            <CardHeader>
              <div className="flex items-center gap-3 text-pm-secondary">
                <Database size={24} />
                <CardTitle className="text-lg">Local-First Profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-pm-body text-sm leading-relaxed">
                Matching details should stay in your browser whenever possible. You can clear your local
                answers and saved trials from this device.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-pm-border/60 shadow-pm">
            <CardHeader>
              <div className="flex items-center gap-3 text-pm-secondary">
                <Lock size={24} />
                <CardTitle className="text-lg">No Data Selling</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-pm-body text-sm leading-relaxed">
                We do not collect contact information or package patients as referrals. The product is
                focused on public trial discovery and explanation.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Collection */}
        <Card className="rounded-2xl border-pm-border/60 shadow-soft mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-pm-ink">What We Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Users size={20} className="text-pm-secondary mt-0.5" />
              <div>
                <h4 className="font-medium text-pm-ink">Matching Inputs</h4>
                <p className="text-sm text-pm-body">
                  Condition, age, sex, ZIP, and screener answers may be used in your browser to match
                  against public trial criteria. Avoid entering names, emails, phone numbers, or other
                  identifying details.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Database size={20} className="text-pm-secondary mt-0.5" />
              <div>
                <h4 className="font-medium text-pm-ink">Usage Data</h4>
                <p className="text-sm text-pm-body">
                  We may collect low-risk product events, such as whether a result was helpful, to improve
                  the experience. We avoid collecting full patient profiles for analytics.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Launch note */}
        <section className="text-center bg-white rounded-2xl border border-pm-border/60 p-6 md:p-8 shadow-soft">
          <h2 className="text-2xl font-semibold text-pm-ink">Public-good launch note</h2>
          <p className="text-pm-body mt-2">
            PatientMatch is being launched as a privacy-first project. The safest default is simple:
            do not enter names, contact details, or anything you would not want stored in your browser.
          </p>
        </section>
      </div>
    </main>
  );
}
