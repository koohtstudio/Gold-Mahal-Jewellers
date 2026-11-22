import type { Metadata } from "next";
import { ReservationsPage } from "@/components/admin/pages/Reservations";

export const metadata: Metadata = { title: "Reservations" };

export default function Page() {
  return <ReservationsPage />;
}
