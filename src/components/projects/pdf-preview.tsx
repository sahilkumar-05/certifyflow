"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Props = {
  url: string;
  pageNumber: number;
  onNumPages: (count: number) => void;
};

export function PdfPreview({ url, pageNumber, onNumPages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      {error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : (
        <div className="flex justify-center">
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => {
              setError("");
              onNumPages(numPages);
            }}
            onLoadError={() => setError("The PDF preview could not be loaded.")}
            loading={
              <p className="py-10 text-center text-sm text-gray-500">
                Loading preview...
              </p>
            }
          >
            <Page
              pageNumber={pageNumber}
              width={Math.min(width, 900)}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="overflow-hidden rounded border shadow-sm"
            />
          </Document>
        </div>
      )}
    </div>
  );
}