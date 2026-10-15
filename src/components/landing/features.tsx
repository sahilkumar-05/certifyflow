import {
  Move,
  FileSpreadsheet,
  Users,
  ServerCog,
  ShieldCheck,
  BarChart3,
} from "lucide-react";

const FEATURES = [
  {
    icon: Move,
    title: "Visual field mapping",
    description:
      "Drag spreadsheet columns onto your PDF and preview real participant data before generating anything.",
  },
  {
    icon: FileSpreadsheet,
    title: "Flexible spreadsheet import",
    description:
      "Works with .xlsx and .csv files and any column names. Missing values and invalid emails are flagged.",
  },
  {
    icon: Users,
    title: "Personalized emails",
    description:
      "Use placeholders in the subject and body so every participant gets their own message and certificate.",
  },
  {
    icon: ServerCog,
    title: "Bring your own SMTP",
    description:
      "Send through your own email account. No paid email service is required.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    description:
      "SMTP passwords are encrypted on the server, and every project is private to its owner.",
  },
  {
    icon: BarChart3,
    title: "Clear results",
    description:
      "See which certificates were generated and which emails failed, then retry failures without regenerating.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-16 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Core Features
          </h2>
          <p className="mt-3 text-gray-600">
            Everything you need to run certificate distribution, without writing
            code or editing certificates one by one.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}