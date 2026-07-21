import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kiezfinder – Wohnungsangebote in Berlin",
  description: "Wohnungsangebote von WBM, HOWOGE, degewo, Gewobag, GESOBAU und STADT UND LAND.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
