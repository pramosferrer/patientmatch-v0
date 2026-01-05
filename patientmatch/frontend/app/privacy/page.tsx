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
            Your privacy is fundamental to our mission. We&apos;re committed to protecting your health information 
            and ensuring transparency about how we use your data.
          </p>
        </header>

        {/* Privacy Principles */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="rounded-lg border-pm-border/60 shadow-pm">
            <CardHeader>
              <div className="flex items-center gap-3 text-pm-secondary">
                <Shield size={24} />
                <CardTitle className="text-lg">HIPAA Compliant</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-pm-body text-sm leading-relaxed">
                We follow HIPAA guidelines to protect your health information. All data is encrypted 
                in transit and at rest, with strict access controls.
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
                You can screen for trials without providing personal information. We only collect 
                what&apos;s necessary for matching and never share without your consent.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-pm-border/60 shadow-pm">
            <CardHeader>
              <div className="flex items-center gap-3 text-pm-secondary">
                <Database size={24} />
                <CardTitle className="text-lg">Secure Storage</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-pm-body text-sm leading-relaxed">
                Your data is stored in secure, encrypted databases with regular security audits. 
                We use industry-standard security practices to protect your information.
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
                We never sell your personal data to third parties. Your information is only used 
                to help you find relevant clinical trials.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Collection */}
        <Card className="rounded-2xl border-pm-border/60 shadow-soft mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-pm-ink">What We Collect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Users size={20} className="text-pm-secondary mt-0.5" />
              <div>
                <h4 className="font-medium text-pm-ink">Health Information</h4>
                <p className="text-sm text-pm-body">Condition, age, gender, and other relevant health details for trial matching.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Database size={20} className="text-pm-secondary mt-0.5" />
              <div>
                <h4 className="font-medium text-pm-ink">Usage Data</h4>
                <p className="text-sm text-pm-body">How you interact with our platform to improve the matching experience.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <section className="text-center bg-white rounded-2xl border border-pm-border/60 p-6 md:p-8 shadow-soft">
          <h2 className="text-2xl font-semibold text-pm-ink">Have questions?</h2>
          <p className="text-pm-body mt-2 mb-4">
            We&apos;re here to help. Contact our privacy team for any concerns about your data.
          </p>
          <a 
            className="text-pm-primary hover:underline" 
            href="mailto:privacy@patientmatch.com"
          >
            privacy@patientmatch.com
          </a>
        </section>
      </div>
    </main>
  );
}


