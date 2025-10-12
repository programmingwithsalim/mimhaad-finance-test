import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Change Password | Mimhaad Finance",
  description: "Change your password",
};

export default function ChangePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
