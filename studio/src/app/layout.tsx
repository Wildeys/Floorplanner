import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Online Drawing Studio",
  description: "Design your building and generate an architectural drawing set.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GlassRefractionFilter />
        {children}
      </body>
    </html>
  );
}

/**
 * The refraction filter every glass panel's frost layer references
 * (DESIGN.md §3.3).
 *
 * Mounted once at the document root, hidden and zero-size, because an SVG
 * filter has to exist in the document for `filter: url(#glass-refraction)` to
 * resolve — a panel cannot carry its own copy without redefining the id.
 */
function GlassRefractionFilter() {
  return (
    <svg className="hidden-svg" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="glass-refraction" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves={2} result="noise" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale={30}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
