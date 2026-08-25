import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Семейные финансы',
  description: 'Учет доходов и расходов семьи',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
