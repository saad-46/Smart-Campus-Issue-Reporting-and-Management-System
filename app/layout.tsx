import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const description = "Report, track and resolve campus maintenance issues in real time.";

export const metadata: Metadata = {
  title: {
    default: "UniFix — Smart Campus Issue Reporting",
    template: "%s · UniFix",
  },
  description,
  applicationName: "UniFix",
  openGraph: {
    title: "UniFix — Smart Campus Issue Reporting",
    description,
    type: "website",
    siteName: "UniFix",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0915" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint — prevents flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('theme') ||
                (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
              var h = document.documentElement;
              if (t === 'dark') { h.classList.add('dark'); }
              else { h.classList.remove('dark'); }
              h.style.colorScheme = t;
            } catch(e){}
          })();
        `}} />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-fg antialiased">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
