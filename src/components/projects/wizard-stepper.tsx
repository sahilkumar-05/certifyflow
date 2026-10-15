import Link from "next/link";
import { Check } from "lucide-react";
import { LAST_AVAILABLE_STEP, WIZARD_STEPS } from "@/lib/wizard-steps";

type Props = {
  projectId: string;
  current: number;
  completed: Record<number, boolean>;
};

export function WizardStepper({ projectId, current, completed }: Props) {
  return (
    <nav aria-label="Project setup progress">
      <ol className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {WIZARD_STEPS.map((step) => {
          const available = step.id <= LAST_AVAILABLE_STEP;
          const isCurrent = step.id === current;
          const isDone = completed[step.id] && !isCurrent;

          const circle = (
            <span
              className={[
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                isCurrent
                  ? "bg-indigo-600 text-white"
                  : isDone
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500",
              ].join(" ")}
            >
              {isDone ? <Check className="h-4 w-4" /> : step.id}
            </span>
          );

          const label = (
            <span
              className={[
                "text-xs font-medium sm:text-sm",
                isCurrent ? "text-gray-900" : "text-gray-600",
              ].join(" ")}
            >
              {step.label}
            </span>
          );

          return (
            <li key={step.id}>
              {available ? (
                <Link
                  href={`/projects/${projectId}?step=${step.id}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className="flex flex-col items-start gap-2 rounded-lg border bg-white p-3 hover:bg-gray-50"
                >
                  {circle}
                  {label}
                </Link>
              ) : (
                <div
                  title="Available in a later update"
                  className="flex cursor-not-allowed flex-col items-start gap-2 rounded-lg border border-dashed bg-white p-3 opacity-60"
                >
                  {circle}
                  {label}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}