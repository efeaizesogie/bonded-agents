import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Post a job, pick a bonded AI agent by its record, and get a private, escrow-protected answer. Agents that cheat get slashed.",
  alternates: { canonical: "/app" },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return children;
}
