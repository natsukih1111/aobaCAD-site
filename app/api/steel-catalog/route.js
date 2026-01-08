// file: app/api/steel-catalog/route.js
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

function normalizeSteelRows(rows) {
  const pick = (o, ...keys) => {
    for (const k of keys) {
      if (o && Object.prototype.hasOwnProperty.call(o, k)) return o[k];
    }
    return undefined;
  };

  const normName = (v) => String(v ?? '').trim();

  return (rows ?? [])
    .map((r) => {
      const name = normName(pick(r, 'name', 'Name', 'NAME', '規格', '呼び名'));
      if (!name) return null;

      const out = { name };

      // よく使うキーは数値化して入れる（存在するものだけ）
      const numeric = [
        ['H', 'h', 'Height', '高さ'],
        ['B', 'b', 'Width', '幅'],
        ['A', 'a'],
        ['t', 'T', 'thickness', '板厚'],
        ['t1', 'T1'],
        ['t2', 'T2'],
        ['r1', 'R1'],
        ['r2', 'R2'],
      ];

      for (const keys of numeric) {
        const canonical = keys[0];
        const v = pick(r, ...keys);
        if (v === undefined || v === null || v === '') continue;
        const n = Number(v);
        out[canonical] = Number.isFinite(n) ? n : v;
      }

      // ※他の列（重量など）も欲しければここで out.xxx = pick(...) して増やせます
      return out;
    })
    .filter(Boolean);
}

function sheetToRows(XLSX, wb, sheetNames) {
  const sheetName = wb.SheetNames.find((sn) => sheetNames.some((n) => sn.toLowerCase() === n.toLowerCase()));
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return normalizeSteelRows(rows);
}

export async function GET() {
  try {
    const XLSX = await import('xlsx');

    // public/steel_catalog.xlsx を読む
    const filePath = path.join(process.cwd(), 'public', 'steel_catalog.xlsx');
    const buf = await fs.readFile(filePath);

    const wb = XLSX.read(buf, { type: 'buffer' });

    const channels = sheetToRows(XLSX, wb, ['Channels', 'Channel', 'CH', 'チャンネル']);
    const angles = sheetToRows(XLSX, wb, ['Angles', 'Angle', 'L', 'アングル']);

    return NextResponse.json({ channels, angles }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
