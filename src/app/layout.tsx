import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Puneet AI Assistant — Executive Command Center",
  description: "Private AI personal assistant for executive task management, daily briefings, schedule organization, and email drafting.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
