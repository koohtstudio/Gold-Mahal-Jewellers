import type { Metadata } from "next";
import { InventoryPage } from "@/components/admin/pages/Inventory";

export const metadata: Metadata = { title: "Inventory" };

export default function Page() {
  return <InventoryPage />;
}
