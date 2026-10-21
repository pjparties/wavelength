/**
 * ASCII diyas as a repeating page backdrop, so the festival theme reads without
 * image assets. It is a tiled SVG data URI: sharp at any zoom, one background
 * image, no DOM nodes.
 */
const DIYA = ["    *    ", "    |    ", "  .-^-.  ", " (     ) ", "  '---'  "];

const CHAR_WIDTH = 9.6;
const LINE_HEIGHT = 22;
const COLUMNS = 4;
const GAP = "   ";

const rows = DIYA.map((row) => Array.from({ length: COLUMNS }, () => row).join(GAP));
const width = Math.round(rows[0].length * CHAR_WIDTH) + 12;
const height = rows.length * LINE_HEIGHT + 8;

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  `<g fill="#A2542B" font-family="ui-monospace,monospace" font-size="16" font-weight="bold">`,
  ...rows.map(
    (row, index) =>
      `<text x="6" y="${22 + index * LINE_HEIGHT}" xml:space="preserve">${row}</text>`,
  ),
  `</g></svg>`,
].join("");

export const DIWALI_BACKGROUND = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
