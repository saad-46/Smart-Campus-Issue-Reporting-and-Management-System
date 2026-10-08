import React, { useId } from "react";
import { cn } from "@/lib/cn";

// Generated, local illustrations for the demo: no photos of real places or
// people, nothing fetched over the network, so there is nothing to load or
// to fail. Each scene is an inline SVG with a fixed 4:3 viewBox that fills
// its box (object-fit: cover behaviour via preserveAspectRatio="slice").

const HUES: Record<string, number> = {
  Electrical: 45,
  Plumbing: 205,
  IT: 262,
  Infrastructure: 24,
  Cleanliness: 150,
  Safety: 6,
  Furniture: 32,
  Landscaping: 128,
  General: 235,
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function Motif({ category, ink }: { category: string; ink: string }) {
  const common = { fill: "none", stroke: ink, strokeWidth: 5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (category) {
    case "Electrical":
      return (
        <g {...common}>
          <path d="M200 70 l-46 70 h38 l-14 58 52-76 h-40 z" fill={ink} fillOpacity=".18" />
          <path d="M120 232 h160" />
          <path d="M150 232 v-14 M250 232 v-14" />
        </g>
      );
    case "Plumbing":
      return (
        <g {...common}>
          <path d="M200 76 c-30 44-52 70-52 100 a52 52 0 0 0 104 0 c0-30-22-56-52-100z" fill={ink} fillOpacity=".18" />
          <path d="M100 236 h200" />
          <path d="M96 236 v-22 M304 236 v-22" />
        </g>
      );
    case "IT":
      return (
        <g {...common}>
          <rect x="120" y="86" width="160" height="104" rx="10" fill={ink} fillOpacity=".14" />
          <path d="M170 224 h60 M200 190 v34" />
          <path d="M170 140 a42 42 0 0 1 60 0 M184 156 a22 22 0 0 1 32 0" />
          <circle cx="200" cy="170" r="3" fill={ink} />
        </g>
      );
    case "Infrastructure":
      return (
        <g {...common}>
          <path d="M110 224 v-110 l90-40 90 40 v110z" fill={ink} fillOpacity=".14" />
          <path d="M200 74 l-14 44 22 20-18 36 20 30" />
          <path d="M96 224 h208" />
        </g>
      );
    case "Cleanliness":
      return (
        <g {...common}>
          <path d="M150 112 h100 l-10 118 h-80z" fill={ink} fillOpacity=".14" />
          <path d="M136 112 h128 M182 112 v-16 h36 v16" />
          <path d="M178 140 l4 70 M200 140 v70 M222 140 l-4 70" />
        </g>
      );
    case "Safety":
      return (
        <g {...common}>
          <path d="M200 76 l92 150 H108z" fill={ink} fillOpacity=".14" />
          <path d="M200 132 v50" />
          <circle cx="200" cy="204" r="3.5" fill={ink} />
        </g>
      );
    case "Furniture":
      return (
        <g {...common}>
          <path d="M150 84 h100 v78 H150z" fill={ink} fillOpacity=".14" />
          <path d="M140 162 h120 v22 H140z" />
          <path d="M156 184 l-8 52 M244 184 l8 52 M200 184 v52" />
        </g>
      );
    case "Landscaping":
      return (
        <g {...common}>
          <circle cx="200" cy="122" r="52" fill={ink} fillOpacity=".16" />
          <path d="M200 174 v62 M200 206 l26-22 M200 196 l-24-20" />
          <path d="M110 236 h180" />
        </g>
      );
    default:
      return (
        <g {...common}>
          <rect x="146" y="82" width="108" height="146" rx="12" fill={ink} fillOpacity=".14" />
          <path d="M176 82 v-10 h48 v10 M174 128 h52 M174 158 h52 M174 188 h30" />
        </g>
      );
  }
}

/** A scene for an issue's category. `seed` varies the composition between issues. */
export function IssuePhoto({ category, seed, alt, className }: { category: string; seed: string; alt: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const h = HUES[category] ?? HUES.General;
  const n = hash(seed);
  const tilt = (n % 9) - 4;
  const sx = 30 + (n % 40);
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label={alt} className={cn("block h-full w-full", className)}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${h} 58% 24%)`} />
          <stop offset="1" stopColor={`hsl(${(h + 34) % 360} 52% 14%)`} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx={`${sx}%`} cy="22%" r="70%">
          <stop offset="0" stopColor={`hsl(${h} 90% 70%)`} stopOpacity=".34" />
          <stop offset="1" stopColor={`hsl(${h} 90% 70%)`} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}-bg)`} />
      <rect width="400" height="300" fill={`url(#${id}-glow)`} />
      <g opacity=".22" stroke={`hsl(${h} 80% 82%)`} strokeWidth="1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M0 ${250 + i * 12} L400 ${236 + i * 12 + tilt}`} />
        ))}
      </g>
      <g transform={`rotate(${tilt} 200 150)`}>
        <Motif category={category} ink={`hsl(${h} 90% 86%)`} />
      </g>
      <g opacity=".5" fill={`hsl(${h} 90% 90%)`}>
        <circle cx={40 + (n % 60)} cy={50 + (n % 40)} r="2.2" />
        <circle cx={340 - (n % 50)} cy={70 + (n % 70)} r="1.8" />
        <circle cx={300 - (n % 90)} cy={34 + (n % 30)} r="1.4" />
      </g>
    </svg>
  );
}

/** A receipt as the real app shows it, drawn locally (amounts and wording come from the demo claim). */
export function ReceiptPreview({ shop, item, amount, className }: { shop: string; item: string; amount: number; className?: string }) {
  return (
    <svg viewBox="0 0 240 320" role="img" aria-label={`Sample receipt from ${shop} for ${item}, ₹${amount.toLocaleString("en-IN")}`} className={cn("block h-full w-full", className)}>
      <rect width="240" height="320" fill="#faf9f5" />
      <path d="M0 0h240v300l-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8-12 8-12-8z" fill="#fff" stroke="#e3dfd2" />
      <text x="120" y="38" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="14" fontWeight="700" fill="#2b2a35">
        {shop.toUpperCase()}
      </text>
      <text x="120" y="56" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9" fill="#77748a">
        Sample receipt · demo only
      </text>
      <path d="M24 72h192" stroke="#cfcab8" strokeDasharray="3 3" />
      <text x="24" y="100" fontFamily="ui-monospace, monospace" fontSize="11" fill="#2b2a35">
        {item.length > 24 ? `${item.slice(0, 23)}…` : item}
      </text>
      <text x="216" y="100" textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="11" fill="#2b2a35">
        ₹{amount.toLocaleString("en-IN")}
      </text>
      <text x="24" y="122" fontFamily="ui-monospace, monospace" fontSize="10" fill="#77748a">
        Qty 1
      </text>
      <path d="M24 146h192" stroke="#cfcab8" strokeDasharray="3 3" />
      <text x="24" y="172" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="700" fill="#2b2a35">
        TOTAL
      </text>
      <text x="216" y="172" textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="700" fill="#2b2a35">
        ₹{amount.toLocaleString("en-IN")}
      </text>
      <g fill="#2b2a35">
        {Array.from({ length: 34 }, (_, i) => (
          <rect key={i} x={30 + i * 5.3} y="214" width={i % 3 === 0 ? 3 : 1.6} height="44" />
        ))}
      </g>
    </svg>
  );
}

const AVATAR_HUES = [262, 235, 205, 172, 150, 32, 335, 290];

/** Initials on a deterministic colour: a stand-in for a profile photo. */
export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const parts = name.replace(/^Dr\.?\s+/i, "").trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  const hue = AVATAR_HUES[hash(name) % AVATAR_HUES.length];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/20", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 62% 52%), hsl(${(hue + 40) % 360} 58% 38%))` }}
    >
      {initials}
    </span>
  );
}
