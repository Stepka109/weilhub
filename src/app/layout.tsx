import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { ServiceWorkerRegistration } from "@/components/layout/sw-register";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./timetable.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "WeilHub",
    template: "%s · WeilHub",
  },
  description: "Neoficiální studentský portál – materiály, úkoly, testy a rozvrh na jednom místě.",
  applicationName: "WeilHub",
  appleWebApp: { capable: true, title: "WeilHub", statusBarStyle: "default" },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
  icons: { apple: [{ url: "/icons/180", sizes: "180x180", type: "image/png" }] },
};

export const viewport: Viewport = {
  themeColor: "#2F68FF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className={`${inter.variable} ${manrope.variable} antialiased`}>
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ style: { borderRadius: 18, fontFamily: "var(--font-inter)" } }}
        />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
