import { CapabilitiesSection } from "../components/capabilities-section";
import { EngineeringSection } from "../components/engineering-section";
import { FinalCtaSection } from "../components/final-cta-section";
import { HeroSection } from "../components/hero-section";
import { MarketingFooter } from "../components/marketing-footer";
import { MarketingNavbar } from "../components/marketing-navbar";
import { ProductPreviewSection } from "../components/product-preview-section";

export function LandingPage() {
  return (
    <div className="min-h-svh bg-background">
      <MarketingNavbar />

      <main>
        <HeroSection />
        <ProductPreviewSection />
        <CapabilitiesSection />
        <EngineeringSection />
        <FinalCtaSection />
      </main>

      <MarketingFooter />
    </div>
  );
}
