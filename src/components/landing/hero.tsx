import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="bg-gradient-to-b from-indigo-50/60 to-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Automate Your Certificates. Save Hours of Work.
          </h1>
          <p className="max-w-xl text-lg text-gray-600">
            Upload your own PDF certificate, import participants from Excel or
            CSV, place fields visually, and send personalized certificates by
            email using your own SMTP account.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={isLoggedIn ? "/dashboard" : "/signup"}
              className={buttonVariants({ size: "lg" })}
            >
              {isLoggedIn ? "Go to Dashboard" : "Get Started"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              See How It Works
            </a>
          </div>
        </div>

        {/* Illustration: a simple certificate mock built with CSS */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-xl border bg-white p-3 shadow-lg">
            <div className="flex aspect-[1.414/1] flex-col items-center justify-center gap-3 rounded-lg border-4 border-double border-indigo-200 bg-white p-6 text-center">
              <p className="text-xs font-medium uppercase tracking-widest text-indigo-500">
                Certificate of Completion
              </p>
              <p className="rounded border border-dashed border-indigo-400 bg-indigo-50 px-3 py-1 font-serif text-2xl text-gray-900">
                {"{{Name}}"}
              </p>
              <p className="text-xs text-gray-500">has successfully completed</p>
              <p className="rounded border border-dashed border-indigo-400 bg-indigo-50 px-3 py-1 text-sm font-medium text-gray-800">
                {"{{Course}}"}
              </p>
              <p className="rounded border border-dashed border-indigo-400 bg-indigo-50 px-2 py-0.5 text-xs text-gray-600">
                {"{{Reference Number}}"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            Fields are filled automatically for every participant.
          </p>
        </div>
      </div>
    </section>
  );
}