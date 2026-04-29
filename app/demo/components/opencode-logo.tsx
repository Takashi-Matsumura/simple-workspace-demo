type Props = {
  className?: string;
  showText?: boolean;
  // 「code」部分のアクセント色 (Tailwind class)。className は SVG の
  // currentColor にしか伝わらないので、テキスト側のテーマ色は別 prop で渡す。
  accentClassName?: string;
};

// オリジナル opencode (sst/opencode) のヘッダーを意識したシンプルなマーク。
// 山形 ‹ › を縦に重ねて “終端 / コード” のニュアンスを表現する。
export function OpenCodeLogo({
  className,
  showText = true,
  accentClassName = "text-blue-700",
}: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="6,3 2,8 6,13" />
        <polyline points="10,3 14,8 10,13" />
      </svg>
      {showText && (
        <span className="font-mono text-[12px] font-semibold tracking-tight">
          <span className="text-slate-500">open</span>
          <span className={accentClassName}>code</span>
        </span>
      )}
    </span>
  );
}
