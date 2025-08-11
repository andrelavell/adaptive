import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Adaptive.ai',
  description: 'Closed-loop creative engine for Meta ads',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="container">
          <h1>Adaptive.ai</h1>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
