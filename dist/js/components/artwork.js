import { escapeHTML } from '../utils/html.js';
function ball(color, x = 160, y = 145, r = 90, scope = 'hero') {
  let lines = '';
  for (let i = -7; i <= 7; i++)
    lines += `<path d="M ${x - r} ${y + i * 12} Q ${x} ${y + i * 8 - r * 0.48} ${x + r} ${y + i * 12 + 30}"/>`;
  return /* HTML */ `<defs
      ><clipPath id="b-${scope}-${x}-${y}"
        ><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.87}" /></clipPath
      ><radialGradient id="g-${scope}-${x}-${y}" cx="35%" cy="25%"
        ><stop stop-color="${color}" /><stop
          offset="1"
          stop-color="${color}"
          stop-opacity=".8" /></radialGradient></defs
    ><ellipse
      cx="${x}"
      cy="${y + r * 0.86}"
      rx="${r * 0.9}"
      ry="12"
      fill="#243e34"
      opacity=".1"
    /><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.87}" fill="url(#g-${scope}-${x}-${y})" /><g
      clip-path="url(#b-${scope}-${x}-${y})"
      stroke="#fff"
      stroke-opacity=".35"
      stroke-width="3"
      fill="none"
      >${lines}</g
    ><g
      clip-path="url(#b-${scope}-${x}-${y})"
      stroke="#243e34"
      stroke-opacity=".14"
      stroke-width="2"
      fill="none"
      transform="rotate(68 ${x} ${y})"
      >${lines}</g
    ><path
      d="M${x + r * 0.8} ${y + r * 0.35} Q${x + r * 1.4} ${y + r * 1.3} ${x + r * 0.7} ${y + r * 1.2}"
      fill="none"
      stroke="${color}"
      stroke-width="4"
    />`;
}
function renderProductArt(p, context = 'catalog') {
  if (p.imageUrl)
    return `<img class="productimage" src="${escapeHTML(p.imageUrl)}" alt="Ảnh sản phẩm" loading="lazy">`;
  return /* HTML */ `<svg viewBox="0 0 340 280" aria-hidden="true">
    ${p.type === 'tools' ? '<g transform="rotate(30 170 140)"><rect x="153" y="100" width="34" height="142" rx="15" fill="#b58b61"/><path d="M170 105 V40 Q170 22 184 32 Q193 44 181 50" stroke="#88988d" stroke-width="12" fill="none" stroke-linecap="round"/></g>' : ball(p.color, 166, 138, 91, `${context}-${p.id}`) + '<rect x="120" y="99" width="90" height="77" rx="2" fill="#faf7ef"/><text x="165" y="130" text-anchor="middle" fill="#355747" font-family="Georgia" font-size="18">Nhung Cap</text><text x="165" y="153" text-anchor="middle" fill="#778170" font-family="Arial" font-size="9">MADE FOR YOUR IDEAS</text>'}
  </svg>`;
}
export function renderHero() {
  document.getElementById('heroArt').insertAdjacentHTML(
    'afterbegin',
    /* HTML */ `<svg viewBox="0 0 520 460" aria-hidden="true">
      <path d="M0 360 Q200 310 520 350 V460 H0" fill="#d7d1bc" />
      <g transform="rotate(-24 300 160)">
        <rect x="295" y="50" width="7" height="270" rx="3" fill="#ac8256" />
        <rect x="325" y="40" width="7" height="270" rx="3" fill="#ac8256" />
      </g>
      ${ball('#c49b94', 355, 200, 83)}${ball('#cfbd96', 159, 254, 83)}${ball('#7f9271', 279, 305, 100)}
      <rect
        x="224"
        y="263"
        width="110"
        height="82"
        fill="#f8f3e7"
        transform="rotate(-12 279 304)"
      />
      <text
        x="279"
        y="304"
        text-anchor="middle"
        font-family="Georgia"
        font-size="24"
        fill="#355747"
        transform="rotate(-12 279 304)"
      >
        Nhung Cap
      </text>
    </svg>`,
  );
}
export { renderProductArt };
