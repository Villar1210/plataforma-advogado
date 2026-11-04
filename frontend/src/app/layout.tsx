import type { Metadata, Viewport } from 'next';
import { AvisosProvider } from '@/components/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'Correspondentes — Gestão de diligências',
  description: 'Gestão de demandas e correspondentes jurídicos',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1c2d4b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <AvisosProvider>{children}</AvisosProvider>
      </body>
    </html>
  );
}
