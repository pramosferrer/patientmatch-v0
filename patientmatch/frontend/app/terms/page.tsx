import Link from "next/link";

export const metadata = { title: "Terms of Use & Medical Disclaimer | PatientMatch" };

export default function TermsPage() {
  return (
    <main className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <nav className="text-sm text-pm-muted mb-6">
          <Link href="/" className="underline hover:no-underline">Home</Link>
          <span className="mx-1">/</span> 
          <span className="text-pm-ink">Terms of Use & Medical Disclaimer</span>
        </nav>

        {/* Content */}
        <div className="prose prose-p:leading-relaxed prose-headings:mt-6 prose-headings:mb-2 max-w-none mt-6 text-pm-ink">
          <h1>Terms of Use & Medical Disclaimer</h1>
          
          <h2>Important Information</h2>
          <p>
            PatientMatch is a platform designed to help patients find relevant clinical trials. 
            We provide information and screening tools, but we are not a medical service provider.
          </p>

          <h2>Medical Disclaimer</h2>
          <p>
            The information provided on PatientMatch is for informational purposes only and should not be 
            considered medical advice. We do not:
          </p>
          <ul>
            <li>Provide medical diagnosis or treatment recommendations</li>
            <li>Guarantee the accuracy of trial information</li>
            <li>Ensure eligibility for any specific trial</li>
            <li>Replace consultation with qualified healthcare professionals</li>
          </ul>

          <h2>Clinical Trial Participation</h2>
          <p>
            Participation in clinical trials involves risks and benefits that should be carefully considered. 
            Always consult with your healthcare provider before participating in any clinical trial. 
            The final determination of eligibility and participation is made by the trial site and investigators.
          </p>

          <h2>Platform Use</h2>
          <p>
            By using PatientMatch, you agree to:
          </p>
          <ul>
            <li>Provide accurate information to the best of your knowledge</li>
            <li>Use the platform for its intended purpose</li>
            <li>Respect the privacy of other users</li>
            <li>Not attempt to circumvent security measures</li>
          </ul>

          <h2>Limitation of Liability</h2>
          <p>
            PatientMatch is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable for any 
            damages arising from the use of our platform or the information provided.
          </p>

          <h2>Privacy</h2>
          <p>
            Your privacy is important to us. Please review our <Link href="/privacy" className="text-pm-primary hover:underline">Privacy Policy</Link> to understand 
            how we collect, use, and protect your information.
          </p>

          <h2>Contact</h2>
          <p>
            If you have questions about these terms, please contact us at{' '}
            <a href="mailto:legal@patientmatch.com" className="text-pm-primary hover:underline">legal@patientmatch.com</a>.
          </p>

          <p className="text-sm text-pm-muted mt-8">
            Last updated: December 2024
          </p>
        </div>
      </div>
    </main>
  );
}
