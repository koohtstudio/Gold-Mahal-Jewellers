import { BagDrawer, VisitDialog } from "@/components/site/reserve";
import { PieceDialog } from "@/components/site/shop";
import { FloatingBar, Footer, SiteProvider, TopBar } from "@/components/site/chrome";
import { ToastProvider } from "@/components/ui";
import s from "@/components/site/site.module.css";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SiteProvider>
        <div className={s.page}>
          <TopBar />
          <main id="main">{children}</main>
          <Footer />
          <FloatingBar />
        </div>
        <BagDrawer />
        <PieceDialog />
        <VisitDialog />
      </SiteProvider>
    </ToastProvider>
  );
}
