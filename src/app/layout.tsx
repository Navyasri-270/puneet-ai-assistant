import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegister from '@/components/PwaRegister';
import AppLayout from '@/components/AppLayout';

export const metadata: Metadata = {
  title: "Puneet AI Assistant — Executive Command Center",
  description: "Private AI personal assistant for executive task management, daily briefings, schedule organization, and email drafting.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Puneet AI",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Puneet AI" />
      </head>
      <body className="bg-slate-50 text-slate-900 font-sans antialiased">
        <PwaRegister />
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  );
}
