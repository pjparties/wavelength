/**
 * Minimal Diwali background - inspired by the reference mockup.
 * Cream paper, faint terracotta ASCII diyas, hanging strings,
 * and tiny saffron sparkles. CSS-only background; no DOM nodes.
 */

const tileWidth = 390;
const tileHeight = 440;

const motifs = [
  { x: 32, y: 48, text: "   |" },
  { x: 32, y: 68, text: "  .|." },
  { x: 32, y: 88, text: " .-^-." },
  { x: 32, y: 108, text: "(     )" },
  { x: 32, y: 128, text: " '---' " },
  { x: 160, y: 74, text: "   *" },
  { x: 160, y: 94, text: "  .+." },
  { x: 160, y: 114, text: "   *" },
  { x: 280, y: 190, text: "   |" },
  { x: 280, y: 210, text: "  .|." },
  { x: 280, y: 230, text: " .-^-. " },
  { x: 280, y: 250, text: "(     )" },
  { x: 280, y: 270, text: " '---' " },
  { x: 100, y: 310, text: "  .  " },
  { x: 100, y: 330, text: "  +  " },
  { x: 100, y: 350, text: "  .  " },
  { x: 180, y: 370, text: "  .^." },
  { x: 180, y: 390, text: " (   )" },
  { x: 180, y: 410, text: " '---' " },
];

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${tileWidth} ${tileHeight}">`,
  `<g stroke="#C85B35" stroke-width="1.5" opacity="0.18">`,
  `<path d="M40 0 V44 M288 0 V186 M188 370 V440" fill="none"/>`,
  `</g>`,
  `<g fill="#C85B35" font-family="monospace" font-size="15" font-weight="400" opacity="0.25">`,
  ...motifs.map(
    ({ x, y, text }) =>
      `<text x="${x}" y="${y}" xml:space="preserve">${escapeXml(text)}</text>`,
  ),
  `</g>`,
  `<g fill="#E6A52E" font-family="monospace" font-size="13" opacity="0.35">`,
  `<text x="350" y="70">*</text>`,
  `<text x="65" y="230">+</text>`,
  `<text x="235" y="155">*</text>`,
  `<text x="340" y="340">+</text>`,
  `<text x="20" y="390">*</text>`,
  `</g>`,
  `</svg>`,
].join("");

export const DIWALI_BACKGROUND =
  `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
