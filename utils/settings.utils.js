import { toBoolean, toNumber, toText } from "./normalizers.js";

export const COMMAND_PALETTE_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center-center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export const PDF_THEME_VALUES = [
  "original",
  "dark",
  "light",
  "sepia_invert",
];

export const DEFAULT_COMMAND_PALETTE_POSITION = "top-center";
export const DEFAULT_PDF_THEME = "original";

const ALLOWED_COMMAND_PALETTE_POSITIONS = new Set(COMMAND_PALETTE_POSITIONS);
const ALLOWED_PDF_THEMES = new Set(PDF_THEME_VALUES);

const PDF_THEME_ALIASES = new Map([
  ["orignal", "original"],
  ["sepia", "light"],
  ["sepia dark", "sepia_invert"],
  ["sepia-dark", "sepia_invert"],
  ["sepia_dark", "sepia_invert"],
]);

export const normalizeCommandPalettePosition = (value) => {
  const position = toText(value, DEFAULT_COMMAND_PALETTE_POSITION);
  return ALLOWED_COMMAND_PALETTE_POSITIONS.has(position)
    ? position
    : DEFAULT_COMMAND_PALETTE_POSITION;
};

export const normalizePdfTheme = (value) => {
  const normalizedValue = toText(value, DEFAULT_PDF_THEME).toLowerCase();
  const canonicalValue =
    PDF_THEME_ALIASES.get(normalizedValue) || normalizedValue;

  return ALLOWED_PDF_THEMES.has(canonicalValue)
    ? canonicalValue
    : DEFAULT_PDF_THEME;
};

export const buildSettingsPayload = (payload = {}) => ({
  showIcons: toBoolean(payload.showIcons, true),
  commandPalettePosition: normalizeCommandPalettePosition(
    payload.commandPalettePosition
  ),
  stackGroups: toBoolean(payload.stackGroups, false),
  stackMaxVisible: toNumber(payload.stackMaxVisible, {
    fallback: 3,
    min: 0,
    max: 20,
  }),
  autoScrollSpeed: toNumber(payload.autoScrollSpeed, {
    fallback: 0,
    min: 0,
    max: 100,
  }),
  sidebarVisible: toBoolean(payload.sidebarVisible, true),
  collapsibleSidebar: toBoolean(payload.collapsibleSidebar, false),
  showCalendarHeatmap: toBoolean(payload.showCalendarHeatmap, true),
  pdfTheme: normalizePdfTheme(payload.pdfTheme),
});

export const buildSettingsBackfillPatch = (settings = {}) => {
  const patch = {};

  if (typeof settings.collapsibleSidebar !== "boolean") {
    patch.collapsibleSidebar = false;
  }

  const normalizedPdfTheme = normalizePdfTheme(settings.pdfTheme);
  if (settings.pdfTheme !== normalizedPdfTheme) {
    patch.pdfTheme = normalizedPdfTheme;
  }

  return patch;
};
