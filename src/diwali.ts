/**
 * Diwali background - a tiled ASCII/SVG scene.
 * Warm cream paper with hanging diyas (glowing gold flames, terracotta bodies),
 * a swag of fairy lights, rangoli stamps, tiny fireworks and gold sparkles.
 * CSS-only background; no DOM nodes. Tile edges line up, so it repeats seamlessly.
 */

const tileWidth = 390;
const tileHeight = 440;

const COLORS = {
  terracotta: "#C2562B",
  flame: "#E8A317",
  saffron: "#E26A2C",
  rani: "#C23B63",
  gold: "#D9921B",
  string: "#B8742F",
};

type Line = { x: number; y: number; text: string };

/** A diya: gold flame on top, terracotta bowl underneath. */
const diya = (x: number, y: number) => ({
  flame: [
    { x, y, text: "   ^" },
    { x, y: y + 18, text: "  (|)" },
  ],
  body: [
    { x, y: y + 38, text: " .-^-." },
    { x, y: y + 56, text: "(     )" },
    { x, y: y + 74, text: " '---' " },
  ],
});

const diyas = [diya(32, 52), diya(280, 192), diya(170, 350)];

const rangoli = (x: number, y: number): Line[] => [
  { x, y, text: "  .:*:." },
  { x, y: y + 18, text: " :*+*+*:" },
  { x, y: y + 36, text: "  ':*:'" },
];

const firework = (x: number, y: number): Line[] => [
  { x, y, text: "\\ | /" },
  { x, y: y + 16, text: "- * -" },
  { x, y: y + 32, text: "/ | \\" },
];

const rangolis = [...rangoli(150, 110), ...rangoli(50, 242)];
const fireworks = [...firework(330, 60), ...firework(60, 372)];

const sparkles: Line[] = [
  { x: 255, y: 62, text: "*" },
  { x: 130, y: 215, text: "+" },
  { x: 240, y: 165, text: "*" },
  { x: 350, y: 330, text: "+" },
  { x: 20, y: 432, text: "*" },
  { x: 300, y: 414, text: "+" },
  { x: 140, y: 300, text: "*" },
];

/**
 * Swag of fairy lights across the top. The curve starts and ends at the same
 * height, so neighbouring tiles join into one continuous string.
 * y(t) = 22 + 56t - 56t^2, x(t) = 390t
 */
const swag = (() => {
  const lightColors = [COLORS.flame, COLORS.rani, COLORS.saffron];
  const lights = Array.from({ length: 10 }, (_, i) => {
    const t = i / 10;
    const x = tileWidth * t;
    const y = 22 + 56 * t - 56 * t * t;
    return `<circle cx="${x.toFixed(1)}" cy="${(y + 4).toFixed(1)}" r="3.2" fill="${lightColors[i % 3]}" opacity="0.6"/>`;
  });
  return [
    `<path d="M0 22 Q195 50 390 22" fill="none" stroke="${COLORS.string}" stroke-width="1.2" opacity="0.3"/>`,
    ...lights,
  ];
})();

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const textNode = ({ x, y, text }: Line) =>
  `<text x="${x}" y="${y}" xml:space="preserve">${escapeXml(text)}</text>`;

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${tileWidth} ${tileHeight}">`,

  // fairy-light swag
  ...swag,

  // strings the two hanging diyas dangle from
  `<g stroke="${COLORS.string}" stroke-width="1.4" opacity="0.3" fill="none">`,
  `<path d="M63 0 V42 M311 0 V182"/>`,
  `</g>`,

  // diya bowls
  `<g fill="${COLORS.terracotta}" font-family="monospace" font-size="15" opacity="0.28">`,
  ...diyas.flatMap((d) => d.body.map(textNode)),
  `</g>`,

  // diya flames (brighter than the bowls so they read as lit)
  `<g fill="${COLORS.flame}" font-family="monospace" font-size="15" font-weight="700" opacity="0.7">`,
  ...diyas.flatMap((d) => d.flame.map(textNode)),
  `</g>`,

  // rangoli stamps
  `<g fill="${COLORS.rani}" font-family="monospace" font-size="14" opacity="0.22">`,
  ...rangolis.map(textNode),
  `</g>`,

  // fireworks
  `<g fill="${COLORS.gold}" font-family="monospace" font-size="14" opacity="0.32">`,
  ...fireworks.map(textNode),
  `</g>`,

  // sparkles
  `<g fill="${COLORS.flame}" font-family="monospace" font-size="13" opacity="0.55">`,
  ...sparkles.map(textNode),
  `</g>`,

  `</svg>`,
].join("");

export const DIWALI_BACKGROUND =
  `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;