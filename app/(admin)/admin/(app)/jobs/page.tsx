import type { Metadata } from "next";
import { JobsPage } from "@/components/admin/pages/Jobs";

export const metadata: Metadata = { title: "Jobs" };

export default function Page() {
  return <JobsPage />;
}
