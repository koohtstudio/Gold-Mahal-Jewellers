import type { Metadata } from "next";
import { OldGoldPage } from "@/components/admin/pages/OldGold";

export const metadata: Metadata = { title: "Old gold" };

export default function Page() {
  return <OldGoldPage />;
}
