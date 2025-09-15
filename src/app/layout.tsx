import type { Metadata } from "next";
import { AuthProvider } from "@/providers/Auth";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deep Agents",
  description: "AI-powered deep agent system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
