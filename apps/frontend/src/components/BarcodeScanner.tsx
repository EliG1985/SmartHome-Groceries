import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
}

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'barcode-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 120 },
        aspectRatio: 1,
      },
      false,
    );

    scanner.render(
      (decodedText) => {
        onDetected(decodedText);
        void scanner.clear();
      },
      () => undefined,
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        void scannerRef.current.clear();
      }
    };
  }, [onDetected]);

  return <div id="barcode-reader" className="rounded-lg border border-slate-200 p-2" />;
}
