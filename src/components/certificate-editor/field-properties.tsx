"use client";

import { useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FONTS } from "@/lib/fonts";
import type { FieldConfig } from "@/lib/validation/mapping";

const selectClass =
  "h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const round = (n: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

type NumberFieldProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
};

// While typing, the text is kept locally. A value is committed as soon as it is valid.
function NumberField({ id, label, value, min, max, step, onCommit }: NumberFieldProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={focused ? text : String(value)}
        onFocus={() => {
          setText(String(value));
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (
            e.target.value.trim() !== "" &&
            Number.isFinite(n) &&
            n >= min &&
            n <= max
          ) {
            onCommit(n);
          }
        }}
      />
    </div>
  );
}

function ColorField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-1">
      <Label htmlFor="field-color">Font color</Label>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label="Pick a color"
          value={value.toLowerCase()}
          onChange={(e) => onCommit(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
        />
        <Input
          id="field-color"
          maxLength={7}
          value={focused ? text : value}
          onFocus={() => {
            setText(value);
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onCommit(v.toLowerCase());
          }}
        />
      </div>
    </div>
  );
}

const ALIGNMENTS = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
] as const;

type Props = {
  field: FieldConfig;
  columns: string[];
  participantCount: number;
  emptyCount: number;
  onChange: (patch: Partial<FieldConfig>) => void;
  onDelete: () => void;
};

export function FieldProperties({
  field,
  columns,
  participantCount,
  emptyCount,
  onChange,
  onDelete,
}: Props) {
  return (
    <div className="space-y-4">
      {emptyCount > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {emptyCount} of {participantCount} participants have no value in the
          &quot;{field.source}&quot; column. This field will be blank on their
          certificates.
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="field-label">Field name</Label>
        <Input
          id="field-label"
          value={field.label}
          maxLength={60}
          onChange={(e) => onChange({ label: e.target.value })}
          onBlur={() => {
            const trimmed = field.label.trim();
            if (!trimmed) onChange({ label: field.source.slice(0, 60) });
            else if (trimmed !== field.label) onChange({ label: trimmed });
          }}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="field-source">Source column</Label>
        <select
          id="field-source"
          className={selectClass}
          value={field.source}
          onChange={(e) =>
            onChange({
              source: e.target.value,
              // Keep the default label in sync with the column.
              label:
                field.label === field.source
                  ? e.target.value.slice(0, 60)
                  : field.label,
            })
          }
        >
          {columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="field-font">Font family</Label>
        <select
          id="field-font"
          className={selectClass}
          value={field.fontFamily}
          onChange={(e) =>
            onChange({ fontFamily: e.target.value as FieldConfig["fontFamily"] })
          }
        >
          {FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id="field-size"
          label="Font size (pt)"
          value={field.fontSize}
          min={6}
          max={200}
          step={1}
          onCommit={(n) => onChange({ fontSize: n })}
        />
        <div className="space-y-1">
          <Label htmlFor="field-case">Text case</Label>
          <select
            id="field-case"
            className={selectClass}
            value={field.textCase}
            onChange={(e) =>
              onChange({ textCase: e.target.value as FieldConfig["textCase"] })
            }
          >
            <option value="none">As written</option>
            <option value="upper">UPPERCASE</option>
            <option value="title">Title Case</option>
          </select>
        </div>
      </div>

      <ColorField value={field.color} onCommit={(color) => onChange({ color })} />

      <div className="space-y-1">
        <Label>Text alignment</Label>
        <div className="grid grid-cols-3 gap-2">
          {ALIGNMENTS.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={field.alignment === value ? "default" : "outline"}
              aria-pressed={field.alignment === value}
              aria-label={`Align ${label}`}
              onClick={() => onChange({ alignment: value })}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          The position below is the {field.alignment === "left" && "left edge"}
          {field.alignment === "center" && "center"}
          {field.alignment === "right" && "right edge"} of the text.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id="field-x"
          label="Position X (%)"
          value={round(field.x * 100)}
          min={0}
          max={100}
          step={0.1}
          onCommit={(n) => onChange({ x: n / 100 })}
        />
        <NumberField
          id="field-y"
          label="Position Y (%)"
          value={round(field.y * 100)}
          min={0}
          max={100}
          step={0.1}
          onCommit={(n) => onChange({ y: n / 100 })}
        />
      </div>
      <p className="-mt-2 text-xs text-gray-500">
        Measured from the top-left corner of the page. Y is the top of the text.
      </p>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={field.width !== null}
            onChange={(e) => onChange({ width: e.target.checked ? 0.5 : null })}
          />
          Limit text width
        </label>
        {field.width !== null && (
          <>
            <NumberField
              id="field-width"
              label="Max width (% of page)"
              value={round(field.width * 100)}
              min={5}
              max={100}
              step={1}
              onCommit={(n) => onChange({ width: n / 100 })}
            />
            <p className="text-xs text-gray-500">
              Long text shrinks to fit inside this width.
            </p>
          </>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full text-red-600"
        onClick={onDelete}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete field
      </Button>
    </div>
  );
}