import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AttributionLog } from "@/components/attribution-log";
import "./globals.css";

export const metadata: Metadata = {
  title: "Py — Workflow Builder",
  description: "A pixel-perfect Galaxy.ai workflow builder clone.",
};

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <body>
      <AttributionLog />
      {children}
    </body>
  );

  return (
    <html lang="en">
      {hasClerk ? <ClerkProvider>{body}</ClerkProvider> : body}
    </html>
  );
}
