/**
 * Illustrations for the homepage offer banners. All artwork is drawn here
 * (generic devices, not any specific brand's product), so it can be used freely.
 */

export function LaptopArt() {
  return (
    <svg viewBox="0 0 440 310" className="cx-art-svg" role="presentation">
      <defs>
        <linearGradient id="lap-lid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a4048" />
          <stop offset="1" stopColor="#16191d" />
        </linearGradient>
        <linearGradient id="lap-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9dde2" />
          <stop offset="1" stopColor="#9aa1a9" />
        </linearGradient>
        <linearGradient id="lap-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f1720" />
          <stop offset="1" stopColor="#14232c" />
        </linearGradient>
        <linearGradient id="lap-glare" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="220" cy="292" rx="200" ry="12" fill="#000" opacity="0.28" />
      {/* lid */}
      <rect x="70" y="18" width="300" height="222" rx="14" fill="url(#lap-lid)" />
      <rect x="82" y="30" width="276" height="196" rx="5" fill="url(#lap-screen)" />
      <circle cx="220" cy="24" r="2.4" fill="#596370" />
      {/* screen: code editor */}
      <rect x="82" y="30" width="276" height="16" rx="5" fill="#1d2a33" />
      <circle cx="93" cy="38" r="3" fill="#ff6b5e" /><circle cx="103" cy="38" r="3" fill="#ffbe3d" /><circle cx="113" cy="38" r="3" fill="#2ccf6e" />
      <rect x="82" y="46" width="56" height="180" fill="#18252e" />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={`f${i}`} x="90" y={56 + i * 14} width={i % 2 ? 30 : 38} height="5" rx="2.5" fill="#3a5361" />)}
      {[
        [150, 58, 70, '#5fd4b8'], [226, 58, 40, '#e8e2a8'],
        [162, 72, 52, '#8ab4ff'], [220, 72, 74, '#d6dde3'],
        [162, 86, 96, '#d6dde3'],
        [174, 100, 46, '#f39bd0'], [226, 100, 58, '#5fd4b8'],
        [174, 114, 84, '#d6dde3'],
        [162, 128, 30, '#8ab4ff'],
        [150, 142, 22, '#e8e2a8'],
        [150, 160, 60, '#5fd4b8'], [216, 160, 88, '#d6dde3'],
        [162, 174, 110, '#8ab4ff'],
        [162, 188, 64, '#d6dde3'], [232, 188, 36, '#f39bd0'],
        [150, 202, 26, '#e8e2a8'],
      ].map(([x, y, w, c], i) => <rect key={`c${i}`} x={x as number} y={y as number} width={w as number} height="5" rx="2.5" fill={c as string} opacity="0.9" />)}
      <rect x="146" y="56" width="2" height="9" fill="#5fd4b8" opacity="0.7" />
      <polygon points="82,30 210,30 120,226 82,226" fill="url(#lap-glare)" />
      {/* hinge + base */}
      <rect x="70" y="236" width="300" height="8" fill="#7d858e" />
      <path d="M28 244 H412 L432 266 Q434 272 426 272 H14 Q6 272 8 266 Z" fill="url(#lap-base)" />
      <path d="M186 244 h68 q-4 8 -12 8 h-44 q-8 0 -12 -8z" fill="#8b929a" />
      <rect x="14" y="270" width="412" height="4" rx="2" fill="#7d858e" />
    </svg>
  );
}

export function PhonesArt() {
  return (
    <svg viewBox="0 0 380 330" className="cx-art-svg" role="presentation">
      <defs>
        <linearGradient id="ph-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9c2ff" />
          <stop offset="0.55" stopColor="#8f7ff0" />
          <stop offset="1" stopColor="#5b47c9" />
        </linearGradient>
        <linearGradient id="ph-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9a8b" />
          <stop offset="0.5" stopColor="#a463f2" />
          <stop offset="1" stopColor="#2f6bff" />
        </linearGradient>
        <radialGradient id="ph-lens" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#3b4a6b" />
          <stop offset="0.6" stopColor="#0b0f1a" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
      </defs>
      <ellipse cx="190" cy="314" rx="150" ry="10" fill="#000" opacity="0.3" />
      {/* back of phone */}
      <g transform="rotate(-11 120 165)">
        <rect x="52" y="22" width="140" height="282" rx="26" fill="url(#ph-back)" />
        <rect x="52" y="22" width="140" height="282" rx="26" fill="none" stroke="#ffffff55" strokeWidth="2" />
        <rect x="66" y="38" width="74" height="96" rx="20" fill="#ffffff2e" stroke="#ffffff44" />
        <circle cx="90" cy="64" r="15" fill="#1d1a33" /><circle cx="90" cy="64" r="11" fill="url(#ph-lens)" />
        <circle cx="90" cy="106" r="15" fill="#1d1a33" /><circle cx="90" cy="106" r="11" fill="url(#ph-lens)" />
        <circle cx="122" cy="64" r="6" fill="#fff6d8" opacity="0.9" />
        <circle cx="122" cy="88" r="4" fill="#1d1a33" />
        <circle cx="86" cy="60" r="3" fill="#fff" opacity="0.35" /><circle cx="86" cy="102" r="3" fill="#fff" opacity="0.35" />
      </g>
      {/* front of phone */}
      <g transform="rotate(8 250 170)">
        <rect x="176" y="20" width="148" height="296" rx="28" fill="#111318" />
        <rect x="183" y="27" width="134" height="282" rx="22" fill="url(#ph-wall)" />
        <circle cx="250" cy="42" r="5" fill="#0b0c10" />
        <text x="250" y="96" textAnchor="middle" fontFamily="Figtree, sans-serif" fontWeight="300" fontSize="40" fill="#fff">10:30</text>
        <text x="250" y="116" textAnchor="middle" fontFamily="Figtree, sans-serif" fontSize="11" fill="#ffffffcc">Tuesday, 13 October</text>
        <rect x="197" y="236" width="106" height="44" rx="14" fill="#ffffff33" />
        <circle cx="216" cy="258" r="10" fill="#ffffff66" />
        <rect x="232" y="250" width="58" height="6" rx="3" fill="#ffffffaa" />
        <rect x="232" y="262" width="38" height="5" rx="2.5" fill="#ffffff77" />
        <rect x="226" y="296" width="48" height="4" rx="2" fill="#ffffffcc" />
        <polygon points="183,27 260,27 200,309 183,309" fill="#fff" opacity="0.08" />
      </g>
    </svg>
  );
}

export function FestiveArt() {
  return (
    <svg viewBox="0 0 460 320" className="cx-art-svg" role="presentation">
      <defs>
        <linearGradient id="fx-lid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a4048" /><stop offset="1" stopColor="#16191d" />
        </linearGradient>
        <linearGradient id="fx-scr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb347" /><stop offset="0.5" stopColor="#ff5f6d" /><stop offset="1" stopColor="#7b2ff7" />
        </linearGradient>
        <linearGradient id="fx-case" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d9dce2" />
        </linearGradient>
        <linearGradient id="fx-phone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2be0b0" /><stop offset="1" stopColor="#0a7d66" />
        </linearGradient>
        <radialGradient id="fx-flame" cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor="#fff7c2" /><stop offset="0.5" stopColor="#ffb52e" /><stop offset="1" stopColor="#ff6a00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="230" cy="304" rx="210" ry="11" fill="#000" opacity="0.3" />
      {/* laptop behind */}
      <rect x="92" y="34" width="250" height="168" rx="12" fill="url(#fx-lid)" />
      <rect x="102" y="44" width="230" height="148" rx="4" fill="url(#fx-scr)" />
      <circle cx="217" cy="118" r="34" fill="#ffffff26" />
      <circle cx="217" cy="118" r="20" fill="#ffffff40" />
      <path d="M64 206 H370 L388 224 Q390 230 382 230 H52 Q44 230 46 224 Z" fill="#c9ced4" />
      {/* phone front-left */}
      <g transform="rotate(-8 120 230)">
        <rect x="70" y="138" width="94" height="170" rx="18" fill="#101216" />
        <rect x="75" y="143" width="84" height="160" rx="14" fill="url(#fx-phone)" />
        <circle cx="117" cy="152" r="3" fill="#0b0c10" />
        <text x="117" y="196" textAnchor="middle" fontFamily="Figtree, sans-serif" fontWeight="300" fontSize="24" fill="#fff">10:30</text>
      </g>
      {/* earbuds case front-right */}
      <g transform="rotate(6 345 250)">
        <rect x="292" y="196" width="112" height="96" rx="34" fill="url(#fx-case)" />
        <path d="M292 236 H404" stroke="#b9bec6" strokeWidth="2" />
        <rect x="336" y="252" width="24" height="5" rx="2.5" fill="#2be0b0" />
        <path d="M318 182 q-16 0 -16 16 q0 14 14 16 l6 44 q1 6 7 6 q6 0 6 -6 l-2 -60 q0 -16 -15 -16z" fill="#fafbfc" stroke="#cfd3d9" />
        <path d="M378 182 q16 0 16 16 q0 14 -14 16 l-6 44 q-1 6 -7 6 q-6 0 -6 -6 l2 -60 q0 -16 15 -16z" fill="#fafbfc" stroke="#cfd3d9" />
      </g>
      {/* diyas */}
      {[[36, 290], [430, 296]].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y - 26} rx="10" ry="16" fill="url(#fx-flame)" />
          <path d={`M${x - 22} ${y - 12} q22 22 44 0 z`} fill="#c2410c" />
          <path d={`M${x - 22} ${y - 12} h44`} stroke="#fdba74" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}

export function ChatArt({ productName, price }: { productName: string; price: string }) {
  return (
    <div className="cx-chat-art">
      <div className="cx-chat-art-head"><span className="cx-chat-art-dot" /> Ask Circuit</div>
      <div className="cx-chat-art-user">Laptop for Figma under ₹80,000?</div>
      <div className="cx-chat-art-bot">
        I'd start with the <b>{productName}</b> at {price}. It's light and handles Figma and assignments well.
      </div>
      <div className="cx-chat-art-pick">
        <span>{productName}<small>{price}</small></span>
        <em>Add to cart</em>
      </div>
    </div>
  );
}
