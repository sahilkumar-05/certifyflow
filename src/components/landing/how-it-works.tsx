import {
  FileUp,
  Table2,
  MousePointerClick,
  Mail,
  Send,
} from "lucide-react";

const STEPS = [
  {
    icon: FileUp,
    title: "Upload your certificate",
    description: "Upload your existing PDF certificate design as the template.",
  },
  {
    icon: Table2,
    title: "Import participants",
    description:
      "Upload an Excel or CSV file. Columns are detected automatically and records are validated.",
  },
  {
    icon: MousePointerClick,
    title: "Place fields visually",
    description:
      "Drag columns such as Name or Course onto the certificate and adjust font, size, color and alignment.",
  },
  {
    icon: Mail,
    title: "Set up your email",
    description:
      "Connect your own SMTP account and write a personalized email subject and body.",
  },
  {
    icon: Send,
    title: "Generate and send",
    description:
      "Review everything, confirm, and CertifyFlow generates and emails each certificate.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            How It Works
          </h2>
          <p className="mt-3 text-gray-600">
            Five simple steps from a PDF template to certificates in your
            participants&apos; inboxes.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold text-indigo-600">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}