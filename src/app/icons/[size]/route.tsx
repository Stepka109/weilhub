import { ImageResponse } from "next/og";

/** PNG ikony pro PWA a iOS generované ze stejného SVG symbolu jako logo. */
const SIZES: Record<string, { size: number; maskable: boolean }> = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "180": { size: 180, maskable: false },
  maskable: { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: key } = await ctx.params;
  const cfg = SIZES[key];
  if (!cfg) return new Response("Not found", { status: 404 });
  const { size, maskable } = cfg;
  // Maskovatelná ikona potřebuje bezpečnou zónu (~80 %) a plné pozadí
  const inner = maskable ? size * 0.62 : size;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#2F68FF" : "transparent",
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 40 40">
          {!maskable && <rect width="40" height="40" rx="12" fill="#2F68FF" />}
          <path
            d="M8 11.5c3.6-.6 6.9.4 9.6 2.6L20 16l2.4-1.9c2.7-2.2 6-3.2 9.6-2.6"
            fill="none"
            stroke="#DCE9FF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9 15.5l5 13.5 6-10.5 6 10.5 5-13.5" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
