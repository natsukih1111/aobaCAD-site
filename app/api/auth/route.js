// file: app/api/auth/route.js
import { NextResponse } from 'next/server';

const PASSWORD = process.env.SITE_PASSWORD || 'aoba';

export async function POST(req) {
  const { pw } = await req.json();

  if (pw === PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('site_auth', PASSWORD, {
      httpOnly: true,
      path: '/',
    });
    return res;
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
