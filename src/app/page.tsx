import { auth } from "@/lib/auth";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = !!session?.user?.id;

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar isLoggedIn={isLoggedIn} />
      <main>
        <Hero isLoggedIn={isLoggedIn} />
        <HowItWorks />
        <Features />
      </main>
      <Footer />
    </div>
  );
}