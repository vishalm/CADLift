import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { links, site } from '@/content/site';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', weight: ['400', '500'] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.title,
  description: site.description,
  authors: [{ name: site.creator, url: links.creator }],
  openGraph: { title: site.title, description: site.description, url: site.url, siteName: site.name, type: 'website' },
  twitter: { card: 'summary_large_image', title: site.title, description: site.description },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = { themeColor: '#0b0d10', colorScheme: 'dark' };

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: site.name,
  description: site.description,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web, macOS, Windows, Linux',
  offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  license: 'https://opensource.org/licenses/MIT',
  url: site.url,
  codeRepository: links.github,
  author: { '@type': 'Person', name: site.creator, url: links.creator },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${mono.variable}`}>
      <body className="grain bg-ink text-paper">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
      </body>
    </html>
  );
}
