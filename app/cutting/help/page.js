// file: app/cutting/help/page.js
'use client';

import Link from 'next/link';

function Section({ title, children }) {
  return (
    <section className="rounded-xl border p-4 space-y-3 bg-white">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-gray-800 leading-6 space-y-2">{children}</div>
    </section>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-gray-50">
      {children}
    </span>
  );
}

function Figure({ src, title, caption }) {
  return (
    <figure className="rounded-xl border bg-white overflow-hidden">
      <div className="px-3 py-2 border-b bg-gray-50">
        <div className="text-sm font-semibold">{title}</div>
      </div>

      {/* next/image ではなく img にして、public 配下の画像をそのまま表示 */}
      <img
        src={src}
        alt={title}
        className="w-full h-auto block"
        style={{ maxHeight: 720, objectFit: 'contain' }}
      />

      {caption && (
        <figcaption className="px-3 py-2 text-xs text-gray-700 border-t">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export default function CuttingHelpPage() {
  return (
    <div className="space-y-4 max-w-5xl">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">材料取り（切断表） 使い方</h1>
          <p className="text-sm text-gray-600">
            棒材 / 鉄板 / エキスパンドの入力方法と、結果画面の見方を「実画面付き」で説明します。
          </p>
        </div>

        <Link
          href="/cutting"
          className="shrink-0 rounded-lg border px-3 py-2 hover:bg-gray-50 text-sm font-semibold"
        >
          ← 切断表へ戻る
        </Link>
      </div>

      {/* 実画面（棒材） */}
      <Figure
        src="/cutting/help/bar_screen.png"
        title="図1：棒材（切断表）の実際の画面"
        caption="※この図と同じ並びで、上から順に説明します。"
      />

      <Section title="1. 画面の上から順に入力する（棒材）">
        <div className="space-y-2">
          <div className="font-semibold">① 材料カテゴリ</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Badge>棒材</Badge>：長さ(mm)を切る材料（FB / L / U / H / SGP / I / 角パイプ）
            </li>
            <li>
              <Badge>鉄板</Badge>：板から矩形を取る（3×6 / 4×8 / 5×10 など）
            </li>
            <li>
              <Badge>エキスパンド</Badge>：鉄板＋「畳目/そろばん目」の向き指定
            </li>
          </ul>

          <div className="font-semibold pt-2">② 種類（L / FB / U…）</div>
          <div>
            切断対象の種類を選びます（例：<Badge>L</Badge>）。種類ごとに「定尺（購入できる）」が保存されます。
          </div>

          <div className="font-semibold pt-2">③ コメント（印刷に残る見出し）</div>
          <div>
            会社名・現場名・部材名などを入れると、紙で管理しやすくなります。
          </div>

          <div className="font-semibold pt-2">④ 定尺（購入できる）</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>「買える材料長」を追加/削除できます。</li>
            <li>丸い <Badge>○○○mm ×</Badge> を押すと、その定尺だけ削除。</li>
            <li>「デフォルトに戻す」で、その種類だけ初期の定尺に戻せます。</li>
          </ul>

          <div className="font-semibold pt-2">⑤ 切断しろ（3mm）</div>
          <div>
            ONのとき、<b>1カットごとに 3mm</b> 余計に材料を消費します（結果の「切断しろ合計」に出ます）。
          </div>

          <div className="font-semibold pt-2">⑥ 重ね切りモード（歩留まり無視）</div>
          <div>
            同じ切断パターンをできるだけ揃えて出します。現場で重ねて切る運用に寄せたいときに使います。
          </div>

          <div className="font-semibold pt-2">⑦ 最適化モード（重要）</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Badge>総端材が一番少なくなる</Badge>：
              全体の合計（買う材料の合計や、総端材）が小さくなるように選びます。
            </li>
            <li>
              <Badge>1本ずつ端材が少なくなる</Badge>：
              「1本の端材」だけを小さくする選び方になり、最後の部材の端材が多く残りやすい切り方です。結果として合計が増える場合があります。
            </li>
          </ul>

          <div className="text-xs text-gray-600">
            ※「定尺を減らしたら歩留まりが良くなる」ことがあるのは正常です。候補が多いほど“局所最適（その1本だけ綺麗）”に引っ張られ、合計が増えるケースがあります。
          </div>

          <div className="font-semibold pt-2">⑧ 必要な切断（長さ / 本数）</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>長さはmm、数量は本数。</li>
            <li>複数行OK。「行を追加」で増やせます。</li>
          </ul>

          <div className="font-semibold pt-2">⑨ 在庫端材（任意・複数OK）</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>工場にある端材があれば入力します（長さ / 本数）。</li>
            <li>端材は可能な限り優先的に使用されます（購入本数が減ります）。</li>
          </ul>
        </div>
      </Section>

      <Section title="2. 結果の見方（棒材）">
        <div className="space-y-2">
          <div className="font-semibold">① 結果まとめ欄（上のブロック）</div>
          <ul className="list-disc pl-5 space-y-1">
            <li><Badge>購入本数（定尺のみ）</Badge>：購入した定尺の本数</li>
            <li><Badge>定尺内訳（購入分）</Badge>：何mmを何本買うか</li>
            <li><Badge>端材使用</Badge>：在庫端材を何本使ったか</li>
            <li><Badge>総材料長</Badge>：使った材料長の合計（購入＋端材）</li>
            <li><Badge>総使用</Badge>：部材＋切断しろで消費した合計</li>
            <li><Badge>総端材</Badge>：残った端材の合計</li>
            <li><Badge>切断しろ合計</Badge>：3mm×カット回数などの合計</li>
            <li><Badge>歩留まり</Badge>：総使用 ÷ 総材料長（%）</li>
          </ul>

          <div className="font-semibold pt-2">② No.1 / No.2 ...（下の明細）</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>1本ごとの切断内容（例：2000 + 1800 + 1500）</li>
            <li>その材料の端材と切断しろ</li>
            <li>右上「まとめ解除/まとめ」：同じ切り方が連続しているものをまとめて表示できます</li>
          </ul>
        </div>
          </Section>

      <Section title="3. 鉄板・エキスパンド（概要）">
        <ul className="list-disc pl-5 space-y-1">
          <li>必要寸法は「縦・横・枚数」を複数入力できます。</li>
          <li>定尺は追加/削除でき、最小の使用枚数になるように割付します。</li>
          <li>エキスパンドは材料ごとに <Badge>畳目</Badge>/<Badge>そろばん目</Badge> を設定できます。</li>
          <li>「方向を気にしない」モードでは、網目方向を無視して枚数を優先します。</li>
        </ul>
      </Section>

      <div className="text-xs text-gray-500 print:hidden">
        ※このページは印刷してもOKですが、上の「戻るリンク」などは印刷されません（print:hidden）。
      </div>
    </div>
  );
}
