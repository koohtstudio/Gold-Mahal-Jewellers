import type { Metadata } from "next";
import { LayawayPage } from "@/components/admin/pages/Layaway";

export const metadata: Metadata = { title: "Layaway" };

export default function Page() {
  return <LayawayPage />;
}
