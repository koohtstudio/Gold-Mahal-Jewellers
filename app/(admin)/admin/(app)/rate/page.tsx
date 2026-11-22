import type { Metadata } from "next";
import { RatePage } from "@/components/admin/pages/RatePage";

export const metadata: Metadata = { title: "Gold rate" };

export default function Page() {
  return <RatePage />;
}
