/**
 * QR rendering constants — SSOT.
 *
 * These two hex values are the one place in the product where a raw colour is
 * correct rather than a token violation: a QR code is read by a camera, not by
 * a person, and scanners need maximum luminance contrast. Theming it would make
 * dark mode produce a low-contrast (sometimes unscannable) code, so the symbol
 * stays true black on true white in both themes and the *frame* around it is
 * what follows the theme.
 *
 * Error-correction level M keeps the code readable when a phone camera catches
 * it at an angle or half-covered by a thumb, without inflating module density.
 *
 * The quiet zone is the white border the QR standard requires around the
 * symbol: four modules. Without it the code's black edge meets whatever frame
 * surrounds it, and in the dark theme that frame is near-black too — scanners
 * then cannot find the corner squares at all (measured on production,
 * 2026-11-12: pay codes on product, service and profile pages decoded in light
 * mode and failed every time in dark).
 */
export const QR_RENDER = {
  bgColor: '#FFFFFF',
  fgColor: '#000000',
  level: 'M',
  defaultSize: 256,
  quietZone: 4,
} as const;
