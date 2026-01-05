import { CheckCircle, Users, Shield } from "lucide-react";

const features = [
  {
    icon: <Users className="h-8 w-8" />,
    title: "Simple Screening",
    description: "Answer a few questions about your condition, age, and location. No personal information required."
  },
  {
    icon: <CheckCircle className="h-8 w-8" />,
    title: "Smart Matching",
    description: "Our AI analyzes trial criteria to find studies you're most likely to qualify for."
  },
  {
    icon: <Shield className="h-8 w-8" />,
    title: "Secure & Private",
    description: "Your information is protected and never shared without your explicit consent."
  }
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-16 bg-pm-warmCream">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-heading text-pm-ink text-3xl sm:text-4xl font-bold mb-8">How it works</h2>
          <p className="text-pm-body text-lg max-w-prose mx-auto">
            Finding the right clinical trial shouldn&apos;t be complicated. We&apos;ve simplified the process into three easy steps.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10 md:gap-16">
          <div className="max-w-prose">
            <div className="space-y-6">
              {features.slice(0, 2).map((feature, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-pm-primary/20 to-pm-accent/20 text-pm-primary">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-heading text-pm-ink font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-pm-body">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="max-w-prose">
            <div className="flex gap-4">
              <div className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-pm-primary/20 to-pm-accent/20 text-pm-primary">
                {features[2].icon}
              </div>
              <div>
                <h3 className="font-heading text-pm-ink font-semibold text-lg mb-2">{features[2].title}</h3>
                <p className="text-pm-body">{features[2].description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
