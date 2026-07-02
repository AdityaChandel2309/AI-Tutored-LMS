import './globals.css';
import { Providers } from './providers';
import { BRAND_NAME } from '@/lib/brand';

export const metadata = {
  title: BRAND_NAME,
  description: 'Enterprise Learning Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

