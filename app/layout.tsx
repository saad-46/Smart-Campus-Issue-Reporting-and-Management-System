import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "UniFix — Smart Campus Issue Reporting",
  description: "AI-powered campus issue reporting and management system.",
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
      <body className="min-h-screen font-sans antialiased bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-white transition-colors duration-300">
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
