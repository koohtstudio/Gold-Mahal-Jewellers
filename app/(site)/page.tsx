import { Categories, Hero, Lookbook, RateSection, Reviews, Services, Story, TradeInSection, TrustStrip, VisitSection } from "@/components/site/sections";
import { ShopSection } from "@/components/site/shop";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <RateSection />
      <Categories />
      <ShopSection />
      <TradeInSection />
      <Services />
      <Lookbook />
      <Story />
      <Reviews />
      <VisitSection />
    </>
  );
}
