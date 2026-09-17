'use client';

/**
 * Point the camera at a wallet's QR code instead of copying an address.
 *
 * Why this is worth a component rather than a library widget: the failure modes
 * are the whole job. A scanner that shows a black rectangle when permission was
 * denied, or spins forever on a desktop with no camera, is worse than the paste
 * field it replaces — the person cannot tell whether it is broken or they are
 * holding it wrong. Every state below says which of those it is.
 *
 * Two decoders, chosen at runtime:
 *   - `BarcodeDetector` when the browser has it (Chromium, Android) — native,
 *     nothing to download.
 *   - `jsQR` otherwise (Safari, Firefox), imported ONLY when the scanner opens,
 *     so the ~15KB never reaches anyone who does not scan.
 *
 * The payload is handed to the same normaliser the paste field uses, because a
 * QR almost always encodes `BITCOIN:BC1Q…` in uppercase rather than a bare
 * address — see lib/wallets/pastedHandle.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle, Loader2 } from 'lucide-react';
import { normalizePastedHandle } from '@/lib/wallets/pastedHandle';

type Phase =
  | { kind: 'starting' }
  | { kind: 'scanning' }
  | { kind: 'blocked'; reason: string; hint: string };

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
}

/** Read one frame. Returns the payload, or null when this frame held no code. */
async function readFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  detector: BarcodeDetectorLike | null
): Promise<string | null> {
  if (detector) {
    const found = await detector.detect(video).catch(() => []);
    return found[0]?.rawValue ?? null;
  }
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    return null;
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.drawImage(video, 0, 0, w, h);
  const { default: jsQR } = await import('jsqr');
  const result = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
    inversionAttempts: 'dontInvert',
  });
  return result?.data ?? null;
}

export default function WalletQrScanner({
  onScanned,
  onClose,
}: {
  onScanned: (handle: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveRef = useRef(true);
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });

  const stop = useCallback(() => {
    liveRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    liveRef.current = true;

    (async () => {
      // A camera needs a secure context. Saying so beats "permission denied",
      // which is what the browser reports and which sends people to reset a
      // permission that was never the problem.
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setPhase({
          kind: 'blocked',
          reason: 'A camera needs a secure connection',
          hint: 'Open OrangeCat over https and try again.',
        });
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase({
          kind: 'blocked',
          reason: 'This browser cannot open a camera',
          hint: 'Paste the address instead — that works everywhere.',
        });
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        setPhase(
          name === 'NotAllowedError'
            ? {
                kind: 'blocked',
                reason: 'Camera access was declined',
                hint: 'Allow the camera in your browser’s address bar, or paste the address instead.',
              }
            : name === 'NotFoundError'
              ? {
                  kind: 'blocked',
                  reason: 'No camera found on this device',
                  hint: 'Paste the address instead.',
                }
              : {
                  kind: 'blocked',
                  reason: 'The camera could not be started',
                  hint: 'Paste the address instead.',
                }
        );
        return;
      }

      if (!liveRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setPhase({ kind: 'scanning' });

      const Detector = (window as unknown as { BarcodeDetector?: new (o: object) => BarcodeDetectorLike })
        .BarcodeDetector;
      let detector: BarcodeDetectorLike | null = null;
      if (Detector) {
        try {
          detector = new Detector({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }

      while (liveRef.current) {
        const v = videoRef.current;
        const c = canvasRef.current;
        if (v && c && v.readyState >= 2) {
          const raw = await readFrame(v, c, detector).catch(() => null);
          if (raw) {
            const handle = normalizePastedHandle(raw);
            if (handle) {
              stop();
              onScanned(handle);
              return;
            }
          }
        }
        await new Promise(r => setTimeout(r, 180));
      }
    })();

    return stop;
  }, [onScanned, stop]);

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Scan a wallet QR code"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface-base">
        <div className="flex items-center justify-between border-b border-default px-4 py-3">
          <span className="text-sm font-medium text-fg-primary">Scan your wallet’s QR code</span>
          <button
            onClick={() => {
              stop();
              onClose();
            }}
            aria-label="Close scanner"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:text-fg-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {phase.kind === 'blocked' ? (
          <div className="p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-fg-tertiary" aria-hidden="true" />
            <p className="text-sm font-medium text-fg-primary">{phase.reason}</p>
            <p className="mt-1 text-sm text-fg-secondary">{phase.hint}</p>
            <button
              onClick={() => {
                stop();
                onClose();
              }}
              className="mt-5 min-h-11 rounded-lg border border-default px-4 text-sm font-medium text-fg-primary"
            >
              Paste instead
            </button>
          </div>
        ) : (
          <>
            <div className="relative aspect-square bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* A viewfinder, so it is obvious where to aim. */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-2/3 w-2/3 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
              {phase.kind === 'starting' && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Opening the camera…
                </div>
              )}
            </div>
            <p className="px-4 py-3 text-center text-xs text-fg-secondary">
              Hold your wallet’s receive code in the frame. It fills in by itself.
            </p>
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

export { Camera as ScannerIcon };
