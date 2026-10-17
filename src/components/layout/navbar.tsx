import Link from "next/link";
import { Award } from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";

type NavbarProps = {
  userName: string;
  userEmail: string;
};

export function Navbar({ userName, userEmail }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Award className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold text-gray-900">
              CertifyFlow
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Dashboard
            </Link>
                        <Link
              href="/settings/smtp"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Email Settings
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight text-gray-900">
              {userName}
            </p>
            <p className="text-xs text-gray-500">{userEmail}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}