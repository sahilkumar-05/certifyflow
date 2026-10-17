"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  displayHeight,
  pointsToPixels,
  type PageSize,
} from "@/lib/mapping/coordinates";
import { applyTextCase } from "@/lib/mapping/text";
import type { FieldConfig } from "@/lib/validation/mapping";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MAX_DISPLAY_WIDTH = 1000;

type Props = {
  fileUrl: string;
  pageNumber: number;
  page: PageSize;
  fields: FieldConfig[];
  selectedId: string | null;
  // Values of the participant currently used for the preview.
  sampleValues: Record<string, string>;
  onSelect: (id: string | null) => void;
};

const SHIFT = { left: "0%", center: "-50%", right: "-100%" } as const;

export function CertificateCanvas({
  fileUrl,
  pageNumber,
  page,
  fields,
  selectedId,
  sampleValues,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(Math.floor(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const width = Math.min(containerWidth, MAX_DISPLAY_WIDTH);
  const height = width > 0 ? displayHeight(page, width) : 0;

  return (
    <div ref={containerRef} className="w-full">
      {error ? (
        <p className="py-10 text-center text-sm text-red-600">{error}</p>
      ) : (
        width > 0 && (
          <div
            className="relative mx-auto overflow-hidden rounded border bg-white shadow-sm"
            style={{ width, height }}
          >
            <Document
              file={fileUrl}
              onLoadError={() => setError("The certificate could not be loaded.")}
              loading={
                <p className="py-10 text-center text-sm text-gray-500">
                  Loading certificate...
                </p>
              }
            >
              <Page
                pageNumber={pageNumber}
                width={width}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            {/* Overlay: same size as the page, so normalized x/y map directly. */}
            <div
              className="absolute inset-0"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) onSelect(null);
              }}
            >
              {fields.map((f) => {
                const selected = f.id === selectedId;
                const raw = sampleValues[f.source] ?? "";
                const text = raw ? applyTextCase(raw, f.textCase) : "{{" + f.source + "}}";

                return (
                  <div
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelect(f.id);
                    }}
                    style={{
                      position: "absolute",
                      left: f.x * width,
                      top: f.y * height,
                      transform: `translateX(${SHIFT[f.alignment]})`,
                      fontFamily: `"${f.fontFamily}", sans-serif`,
                      fontSize: pointsToPixels(f.fontSize, page, width),
                      lineHeight: 1,
                      color: f.color,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      opacity: raw ? 1 : 0.55,
                      outline: selected
                        ? "2px solid #4f46e5"
                        : "1px dashed rgba(79,70,229,0.4)",
                      outlineOffset: 3,
                    }}
                  >
                    {text}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}