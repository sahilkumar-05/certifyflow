import Link from "next/link";
import { Award } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
            <Award className="h-4 w-4" />
          </span>
          <span className="font-semibold text-gray-900">CertifyFlow</span>
        </div>

        <nav className="flex items-center gap-4 text-sm text-gray-600">
          <a href="#how-it-works" className="hover:text-gray-900">
            How It Works
          </a>
          <a href="#features" className="hover:text-gray-900">
            Features
          </a>
          <Link href="/login" className="hover:text-gray-900">
            Login
          </Link>
        </nav>

        <p className="text-sm text-gray-500">
          &copy; {new Date().getFullYear()} CertifyFlow. All rights reserved.
        </p>
      </div>
    </footer>
  );
}