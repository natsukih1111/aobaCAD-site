// file: middleware.js
import { NextResponse } from 'next/server';

const PASSWORD = process.env.SITE_PASSWORD || 'aoba';

export function middleware(req) {
  // ✅ ローカル開発中は認証しない
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // 認証ページと静的ファイルは通す
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const auth = req.cookies.get('site_auth');

  if (auth?.value === PASSWORD) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = '/auth';
  return NextResponse.redirect(url);
}
