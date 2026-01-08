// file: app/layout.js
import './globals.css';
import AppHeader from '@/components/AppHeader';

export const metadata = {
  title: '3DCADサイト',
  description: '3D CAD in browser',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <AppHeader />
        <main style={{ padding: 16 }}>{children}</main>
      </body>
    </html>
  );
}
