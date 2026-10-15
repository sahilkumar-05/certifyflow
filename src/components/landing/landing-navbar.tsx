import Link from "next/link";
import { Award } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function LandingNavbar({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Award className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold text-gray-900">
            CertifyFlow
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <a
            href="#how-it-works"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            How It Works
          </a>
          <a
            href="#features"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Features
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <Link href="/dashboard" className={buttonVariants()}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={buttonVariants({ variant: "ghost" })}
              >
                Login
              </Link>
              <Link href="/signup" className={buttonVariants()}>
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}