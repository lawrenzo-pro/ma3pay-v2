import React, { useEffect, useRef, useState } from 'react';
import { QrCode, CameraOff, RefreshCcw } from 'lucide-react';

interface TripQrScannerProps {
  active: boolean;
  isDark: boolean;
  scanError?: string;
  onDetected: (payload: string) => void;
  onSimulate: () => void;
}

type CameraState = 'idle' | 'starting' | 'ready' | 'error';

export const TripQrScanner: React.FC<TripQrScannerProps> = ({
  active,
  isDark,
  scanError,
  onDetected,
  onSimulate
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [supportsDetector, setSupportsDetector] = useState(true);

  useEffect(() => {
    setSupportsDetector(typeof (window as any).BarcodeDetector === 'function');
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    detectedRef.current = false;
    setCameraError('');
    setCameraState('starting');

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('error');
        setCameraError('Camera not available on this device.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!cancelled) {
          setCameraState('ready');
        }
      } catch (error) {
        console.error('Camera start failed', error);
        setCameraState('error');
        setCameraError('Camera permission denied or unavailable.');
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [active, restartKey]);

  useEffect(() => {
    if (!active || !supportsDetector) {
      return;
    }

    let rafId = 0;
    const DetectorCtor = (window as any).BarcodeDetector;
    if (typeof DetectorCtor !== 'function') {
      setSupportsDetector(false);
      return;
    }

    const detector = new DetectorCtor({ formats: ['qr_code'] });

    const scan = async () => {
      if (!videoRef.current || detectedRef.current) {
        rafId = requestAnimationFrame(scan);
        return;
      }

      if (videoRef.current.readyState < 2) {
        rafId = requestAnimationFrame(scan);
        return;
      }

      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes && barcodes.length > 0) {
          detectedRef.current = true;
          onDetected(barcodes[0].rawValue || '');
          return;
        }
      } catch (error) {
        console.warn('QR detection error', error);
      }

      rafId = requestAnimationFrame(scan);
    };

    rafId = requestAnimationFrame(scan);

    return () => cancelAnimationFrame(rafId);
  }, [active, supportsDetector, onDetected]);

  return (
    <div className="w-full max-w-sm mx-auto space-y-4">
      <div
        className={`relative w-full aspect-square rounded-3xl overflow-hidden border-2 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
      >
        {cameraState === 'ready' ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {cameraState === 'error' ? <CameraOff size={28} /> : <QrCode size={28} />}
            </div>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {cameraState === 'starting' ? 'Starting camera...' : 'Camera preview will appear here'}
            </p>
            <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Allow camera access to scan the matatu QR code.
            </p>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-8 border-2 border-dashed border-yellow-400/80 rounded-2xl"></div>
          <div className="absolute inset-8 shadow-[0_0_0_9999px_rgba(0,0,0,0.15)] rounded-2xl"></div>
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
          Align the QR inside the frame
        </p>
        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {supportsDetector
            ? 'Scanning automatically once the code is visible.'
            : 'QR scanning is not supported here. Use Enter Code or Simulate Scan.'}
        </p>
      </div>

      {(cameraError || scanError) && (
        <div
          className={`text-xs rounded-xl p-3 border ${
            isDark
              ? 'bg-red-900/30 border-red-700/40 text-red-200'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}
        >
          {scanError || cameraError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setRestartKey((prev) => prev + 1)}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
            isDark
              ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
              : 'border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <RefreshCcw size={16} />
          Retry
        </button>
        <button
          onClick={onSimulate}
          className="flex flex-1 items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold transition-all"
        >
          Simulate Scan
        </button>
      </div>
    </div>
  );
};
