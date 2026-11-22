import type { Metadata } from "next";
import { BooksPage } from "@/components/admin/pages/Books";

export const metadata: Metadata = { title: "Books" };

export default function Page() {
  return <BooksPage />;
}
