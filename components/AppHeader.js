// file: components/AppHeader.js
import Link from 'next/link';

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-bold">
          3DCADサイト
        </Link>

        <nav className="flex gap-3 text-sm">
          <Link className="rounded-lg px-2 py-1 hover:bg-gray-100" href="/editor">
            3D
          </Link>
          <Link className="rounded-lg px-2 py-1 hover:bg-gray-100" href="/library">
            鋼材テンプレ
          </Link>
          <Link className="rounded-lg px-2 py-1 hover:bg-gray-100" href="/materials">
            材質
          </Link>
        </nav>
      </div>
    </header>
  );
}
