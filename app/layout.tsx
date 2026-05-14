import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Syne } from 'next/font/google';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';

const sans = Inter({ variable: '--font-geist-sans', subsets: ['latin'] });
const mono = JetBrains_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const display = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'n8n Workflow Generator',
  description: 'Generate importable n8n workflow JSON from plain English using AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} h-full`}>
      <body className="h-full bg-[#0e0e10] text-zinc-100 antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
