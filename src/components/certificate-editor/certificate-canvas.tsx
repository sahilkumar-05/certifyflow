"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  displayHeight,
  pixelsToNormalized,
  pointsToPixels,
  type PageSize,
} from "@/lib/mapping/coordinates";
import { COLUMN_DRAG_TYPE } from "@/lib/mapping/drag";
import { applyTextCase, fitFontSize } from "@/lib/mapping/text";
import type { FieldConfig } from "@/lib/validation/mapping";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MAX_DISPLAY_WIDTH = 1000;

const SHIFT = { left: "0%", center: "-50%", right: "-100%" } as const;
const ORIGIN = {
  left: "left top",
  center: "center top",
  right: "right top",
} as const;

type FieldBoxProps = {
  field: FieldConfig;
  text: string;
  hasValue: boolean;
  selected: boolean;
  page: PageSize;
  width: number;
  height: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
};

function FieldBox({
  field,
  text,
  hasValue,
  selected,
  page,
  width,
  height,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
}: FieldBoxProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Width of the text at its normal size, in pixels (transforms do not affect it).
  const [natural, setNatural] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setNatural(el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fontPx = pointsToPixels(field.fontSize, page, width);

  // Same rule the PDF generator will use: shrink the font so text fits the max width.
  const naturalPt = (natural * page.width) / width;
  const maxPt = field.width === null ? null : field.width * page.width;
  const fitted = fitFontSize(field.fontSize, naturalPt, maxPt);
  const scale = fitted / field.fontSize;

  return (
    <>
      {selected && field.width !== null && (
        <div
          style={{
            position: "absolute",
            left: field.x * width,
            top: field.y * height,
            width: field.width * width,
            height: fontPx,
            transform: `translateX(${SHIFT[field.alignment]})`,
            border: "1px dashed rgba(217,119,6,0.9)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={`Field ${field.label}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          position: "absolute",
          left: field.x * width,
          top: field.y * height,
          transform: `translateX(${SHIFT[field.alignment]}) scale(${scale})`,
          transformOrigin: ORIGIN[field.alignment],
          fontFamily: `"${field.fontFamily}", sans-serif`,
          fontSize: fontPx,
          lineHeight: 1,
          color: field.color,
          whiteSpace: "nowrap",
          cursor: "move",
          touchAction: "none",
          userSelect: "none",
          zIndex: selected ? 2 : 1,
          opacity: hasValue ? 1 : 0.55,
          outline: selected
            ? "2px solid #4f46e5"
            : "1px dashed rgba(79,70,229,0.4)",
          outlineOffset: 3,
        }}
      >
        {text}
      </div>
    </>
  );
}

type Props = {
  fileUrl: string;
  pageNumber: number;
  page: PageSize;
  fields: FieldConfig[];
  selectedId: string | null;
  // Values of the participant currently used for the preview.
  sampleValues: Record<string, string>;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDropColumn: (column: string, x: number, y: number) => void;
};

type DragState = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

export function CertificateCanvas({
  fileUrl,
  pageNumber,
  page,
  fields,
  selectedId,
  sampleValues,
  onSelect,
  onMove,
  onDropColumn,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [error, setError] = useState("");
  const [dropActive, setDropActive] = useState(false);

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

  function startMove(e: React.PointerEvent<HTMLDivElement>, f: FieldConfig) {
    e.stopPropagation();
    onSelect(f.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      id: f.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: f.x,
      originY: f.y,
    };
  }

  function continueMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;

    // Pixels moved since the pointer went down, converted back to normalized.
    const p = pixelsToNormalized(
      {
        x: d.originX * width + (e.clientX - d.startX),
        y: d.originY * height + (e.clientY - d.startY),
      },
      width,
      height
    );
    onMove(d.id, p.x, p.y);
  }

  function endMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }

  function isColumnDrag(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes(COLUMN_DRAG_TYPE);
  }

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
              style={{
                boxShadow: dropActive ? "inset 0 0 0 3px #4f46e5" : undefined,
              }}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) onSelect(null);
              }}
              onDragOver={(e) => {
                if (!isColumnDrag(e)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(e) => {
                setDropActive(false);
                const column = e.dataTransfer.getData(COLUMN_DRAG_TYPE);
                if (!column) return;
                e.preventDefault();

                const rect = e.currentTarget.getBoundingClientRect();
                const p = pixelsToNormalized(
                  { x: e.clientX - rect.left, y: e.clientY - rect.top },
                  rect.width,
                  rect.height
                );
                onDropColumn(column, p.x, p.y);
              }}
            >
              {fields.map((f) => {
                const raw = (sampleValues[f.source] ?? "").trim();
                const hasValue = raw !== "";
                const text = hasValue
                  ? applyTextCase(raw, f.textCase)
                  : "{{" + f.source + "}}";

                return (
                  <FieldBox
                    key={f.id}
                    field={f}
                    text={text}
                    hasValue={hasValue}
                    selected={f.id === selectedId}
                    page={page}
                    width={width}
                    height={height}
                    onPointerDown={(e) => startMove(e, f)}
                    onPointerMove={continueMove}
                    onPointerEnd={endMove}
                  />
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}