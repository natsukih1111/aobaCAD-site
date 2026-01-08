// file: app/auth/page.js
'use client';

import { useState } from 'react';

export default function AuthPage() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pw }),
    });

    if (res.ok) {
      location.href = '/';
    } else {
      setError('パスワードが違います');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="border rounded-xl p-6 space-y-3">
        <div className="font-bold text-lg">パスワード入力</div>
        <input
          type="password"
          className="border rounded p-2 w-64"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <button className="w-full bg-black text-white rounded p-2">
          入る
        </button>
      </form>
    </div>
  );
}
