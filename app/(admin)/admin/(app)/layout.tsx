import { AdminShell } from "@/components/admin/Shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
