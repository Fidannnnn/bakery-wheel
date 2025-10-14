// web/app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bakery Wheel",
  description: "Spin & redeem",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 16, fontFamily: "ui-sans-serif, system-ui" }}>{children}</body>
    </html>
  );
}
