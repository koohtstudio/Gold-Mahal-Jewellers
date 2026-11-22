import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginCard } from "@/components/admin/Login";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginCard />
    </Suspense>
  );
}
