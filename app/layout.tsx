import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hybrid & Electric Car Service Center",
  description: "Bookings, memberships, accounting, and operations platform."
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

