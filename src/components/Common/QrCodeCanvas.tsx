import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrCodeCanvasProps {
  url: string;
  size?: number;
  className?: string;
  onGenerated?: (dataUrl: string) => void;
}

export const QrCodeCanvas: React.FC<QrCodeCanvasProps> = ({ 
  url, 
  size = 240, 
  className = '',
  onGenerated 
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !url) return;

    QRCode.toCanvas(
      canvasRef.current,
      url,
      {
        width: size,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      },
      (error) => {
        if (error) {
          console.error('QR code generation failed:', error);
        } else if (canvasRef.current && onGenerated) {
          try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            onGenerated(dataUrl);
          } catch {
            // ignore
          }
        }
      }
    );
  }, [url, size, onGenerated]);

  return (
    <div className={`inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm border border-slate-200/80 ${className}`}>
      <canvas ref={canvasRef} className="max-w-full h-auto rounded-lg" />
    </div>
  );
};
