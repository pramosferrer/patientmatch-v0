import ProcessStepper from "@/app/components/marketing/ProcessStepper";

export default function ProcessStepperDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pm-softBlue/30 via-white to-pm-brightCream/30 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="font-sans text-4xl md:text-5xl font-bold text-pm-ink mb-4">
            Process Stepper Demo
          </h1>
          <p className="text-pm-body text-lg max-w-2xl mx-auto">
            Interactive 4-step process demonstration with smooth animations and accessible navigation.
          </p>
        </div>

        <ProcessStepper />
      </div>
    </div>
  );
}
