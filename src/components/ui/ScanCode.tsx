import type { ComponentProps } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QR_RENDER } from '@/config/payment-qr';

type ScanCodeProps = Omit<
  ComponentProps<typeof QRCodeSVG>,
  'bgColor' | 'fgColor' | 'marginSize' | 'includeMargin' | 'level'
>;

/**
 * A QR code as a camera reads it: black on white with the standard four-module
 * quiet zone, in either theme, at error-correction level M (QR_RENDER).
 *
 * The one way this app draws a QR. Twelve call sites used qrcode.react
 * directly and nine of them left out the quiet zone, so their codes did not
 * scan in the dark theme.
 */
export function ScanCode({ size = QR_RENDER.defaultSize, ...props }: ScanCodeProps) {
  return (
    <QRCodeSVG
      {...props}
      size={size}
      level={QR_RENDER.level}
      bgColor={QR_RENDER.bgColor}
      fgColor={QR_RENDER.fgColor}
      marginSize={QR_RENDER.quietZone}
    />
  );
}
