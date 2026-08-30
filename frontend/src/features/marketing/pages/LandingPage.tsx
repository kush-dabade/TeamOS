import { HeroSection } from "../components/hero-section";
import { MarketingNavbar } from "../components/marketing-navbar";
import { ProductPreviewSection } from "../components/product-preview-section";

export function LandingPage() {
  return (
    <div className="min-h-svh bg-background">
      <MarketingNavbar />

      <main>
        <HeroSection />
        <ProductPreviewSection />
      </main>
    </div>
  );
}
