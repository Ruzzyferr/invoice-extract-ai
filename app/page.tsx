"use client";

import { useCallback, useRef, useState } from "react";
import { SAMPLES } from "@/lib/samples";
import type { Extraction, ExtractResponse } from "@/lib/types";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
};

type PickedFile = {
  name: string;
  size: number;
  mimeType: string;
  base64: string;
};

type Status = "idle" | "loading" | "done" | "failed";

/* ---------- helpers ---------- */

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMoney(n: number | null, currency: string | null): string {
  if (n === null) return "—";
  if (currency) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(n);
    } catch {
      /* unknown code — fall through to plain formatting */
    }
  }
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQty(n: number | null): string {
  if (n === null) return "—";
  return Number.isInteger(n) ? String(n) : n.toLocaleString("en-US");
}

function csvEscape(v: string | number | null): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(extraction: Extraction) {
  const rows: (string | number | null)[][] = [
    ["Description", "Quantity", "Unit price", "Amount"],
    ...extraction.lineItems.map((it) => [
      it.description,
      it.quantity,
      it.unitPrice,
      it.amount,
    ]),
    [],
    ["Subtotal", "", "", extraction.subtotal],
    ["Tax / VAT", "", "", extraction.tax],
    ["Total", "", "", extraction.total],
  ];
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  // Prepend a UTF-8 BOM so Excel detects the encoding
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${extraction.invoiceNumber ?? "invoice"}-extract.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* ---------- small presentational pieces ---------- */

function Dash() {
  return <span className="text-ink-faint">—</span>;
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm text-ink break-words ${mono ? "font-mono" : ""}`}
      >
        {value ?? <Dash />}
      </dd>
    </div>
  );
}

/* ---------- page ---------- */

export default function Home() {
  const [tab, setTab] = useState<"upload" | "text">("upload");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [text, setText] = useState("");
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [inputNotice, setInputNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback(async (f: File) => {
    setInputNotice(null);
    if (!(f.type in ACCEPTED_TYPES)) {
      setInputNotice("That file type isn't supported. Use PDF, PNG or JPG.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setInputNotice(`That file is ${formatBytes(f.size)} — the limit is 4 MB.`);
      return;
    }
    try {
      const base64 = await fileToBase64(f);
      setFile({ name: f.name, size: f.size, mimeType: f.type, base64 });
    } catch {
      setInputNotice("The file couldn't be read. Try a different file.");
    }
  }, []);

  const canExtract =
    status !== "loading" &&
    (tab === "upload" ? file !== null : text.trim() !== "");

  async function extract() {
    if (status === "loading") return;
    setStatus("loading");
    setResult(null);
    try {
      const payload =
        tab === "upload" && file
          ? {
              mode: "file" as const,
              fileBase64: file.base64,
              mimeType: file.mimeType,
            }
          : { mode: "text" as const, text };
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ExtractResponse;
      setResult(data);
      setStatus("done");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Toolbar */}
      <header className="border-b border-hairline bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-sm bg-ledger font-mono text-sm font-bold text-white"
            >
              ¶
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-none tracking-tight">
                Invoice Extract
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                documents → structured data
              </p>
            </div>
          </div>
          <p className="hidden text-xs text-ink-soft sm:block">
            Gemini multimodal · strict JSON output · CSV export
          </p>
        </div>
      </header>

      {/* Workbench */}
      <main className="ruled-bg mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        {/* ------- Input panel ------- */}
        <section
          aria-labelledby="source-heading"
          className="rounded-md border border-hairline bg-card shadow-[0_1px_2px_rgba(27,36,32,0.06)]"
        >
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <h2
              id="source-heading"
              className="font-display text-sm font-semibold uppercase tracking-[0.1em]"
            >
              Source document
            </h2>
            <div
              role="tablist"
              aria-label="Input mode"
              className="flex rounded-sm border border-hairline p-0.5"
            >
              {(
                [
                  ["upload", "Upload"],
                  ["text", "Paste text"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => {
                    setTab(key);
                    setInputNotice(null);
                  }}
                  className={`rounded-[3px] px-3 py-1 text-xs font-medium transition-colors ${
                    tab === key
                      ? "bg-ledger text-white"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {tab === "upload" ? (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) void acceptFile(f);
                  }}
                  className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    dragOver
                      ? "border-ledger bg-ledger-tint"
                      : "border-hairline-strong bg-paper"
                  }`}
                >
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">
                    PDF · PNG · JPG · max 4 MB
                  </p>
                  <p className="mt-3 text-sm text-ink-soft">
                    Drop an invoice here, or
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 rounded-sm border border-ledger px-4 py-1.5 text-sm font-medium text-ledger transition-colors hover:bg-ledger hover:text-white"
                  >
                    Choose a file
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void acceptFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                {file && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-sm border border-hairline bg-paper px-3 py-2">
                    <p className="min-w-0 truncate font-mono text-xs text-ink">
                      {file.name}
                      <span className="ml-2 text-ink-faint">
                        {ACCEPTED_TYPES[file.mimeType]} ·{" "}
                        {formatBytes(file.size)}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="shrink-0 text-xs font-medium text-ink-soft underline-offset-2 hover:text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <label
                  htmlFor="invoice-text"
                  className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint"
                >
                  Invoice text
                </label>
                <textarea
                  id="invoice-text"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setActiveSample(null);
                  }}
                  rows={12}
                  spellCheck={false}
                  placeholder="Paste the full text of an invoice here…"
                  className="mt-2 w-full resize-y rounded-sm border border-hairline bg-paper p-3 font-mono text-xs leading-relaxed text-ink placeholder:text-ink-faint"
                />
                <div className="mt-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                    Or load a sample
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SAMPLES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setText(s.text);
                          setActiveSample(s.id);
                        }}
                        className={`rounded-sm border px-3 py-1.5 text-left text-xs transition-colors ${
                          activeSample === s.id
                            ? "border-ledger bg-ledger-tint text-ledger-deep"
                            : "border-hairline text-ink-soft hover:border-hairline-strong hover:text-ink"
                        }`}
                      >
                        <span className="font-medium">{s.label}</span>
                        <span className="ml-2 font-mono text-[10px] text-ink-faint">
                          {s.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {inputNotice && (
              <p role="alert" className="mt-3 text-xs text-danger">
                {inputNotice}
              </p>
            )}

            <button
              type="button"
              onClick={() => void extract()}
              disabled={!canExtract}
              className="mt-5 w-full rounded-sm bg-ledger px-4 py-2.5 font-display text-sm font-semibold tracking-wide text-white transition-colors hover:bg-ledger-deep disabled:cursor-not-allowed disabled:bg-hairline-strong"
            >
              {status === "loading" ? "Extracting…" : "Extract data"}
            </button>
          </div>
        </section>

        {/* ------- Result panel ------- */}
        <section
          aria-labelledby="record-heading"
          aria-busy={status === "loading"}
          className="rounded-md border border-hairline bg-card shadow-[0_1px_2px_rgba(27,36,32,0.06)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3">
            <h2
              id="record-heading"
              className="font-display text-sm font-semibold uppercase tracking-[0.1em]"
            >
              Extracted record
            </h2>
            {status === "done" && result && (
              <div className="flex items-center gap-2">
                {result.mock ? (
                  <span className="rounded-sm border border-amber-line bg-amber-bg px-2.5 py-1 text-[11px] font-medium text-amber-ink">
                    Demo mode — sample response
                  </span>
                ) : (
                  <span className="rounded-sm border border-hairline bg-paper px-2.5 py-1 font-mono text-[11px] text-ink-soft">
                    {result.model ?? "gemini"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => downloadCsv(result.extraction)}
                  className="rounded-sm border border-ledger px-3 py-1 text-xs font-medium text-ledger transition-colors hover:bg-ledger hover:text-white"
                >
                  Download CSV
                </button>
              </div>
            )}
          </div>

          <div className="relative overflow-hidden p-5">
            {status === "idle" && (
              <div className="flex flex-col items-center py-16 text-center">
                <p aria-hidden className="font-mono text-3xl text-hairline-strong">
                  ¶ — — —
                </p>
                <p className="mt-4 max-w-xs text-sm text-ink-soft">
                  No document processed yet. Upload an invoice or paste its
                  text, then run the extraction.
                </p>
              </div>
            )}

            {status === "loading" && (
              <div aria-hidden className="relative py-2">
                <div className="scanline pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-ledger/15 to-transparent" />
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="pulse-row h-9 rounded-sm bg-hairline"
                      style={{ animationDelay: `${i * 90}ms` }}
                    />
                  ))}
                </div>
                <div className="mt-6 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="pulse-row h-7 rounded-sm bg-hairline"
                      style={{ animationDelay: `${(i + 6) * 90}ms` }}
                    />
                  ))}
                </div>
                <p className="mt-6 text-center font-mono text-xs text-ink-faint">
                  Reading the document…
                </p>
              </div>
            )}

            {status === "failed" && (
              <div className="flex flex-col items-center py-16 text-center">
                <p className="max-w-xs text-sm text-ink-soft">
                  The extraction service couldn&apos;t be reached. Check your
                  connection and try again.
                </p>
                <button
                  type="button"
                  onClick={() => void extract()}
                  className="mt-4 rounded-sm border border-ledger px-4 py-1.5 text-sm font-medium text-ledger transition-colors hover:bg-ledger hover:text-white"
                >
                  Try again
                </button>
              </div>
            )}

            {status === "done" && result && (
              <ResultView extraction={result.extraction} />
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ink-soft sm:px-6">
          <p>
            Built by{" "}
            <a
              href="https://github.com/Ruzzyferr"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ledger underline-offset-2 hover:underline"
            >
              Ruzzyferr
            </a>{" "}
            — full-stack &amp; AI integration developer
          </p>
          <p className="font-mono text-[11px] text-ink-faint">
            Next.js · Gemini · no data stored
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ---------- extracted record (the ledger sheet) ---------- */

function ResultView({ extraction }: { extraction: Extraction }) {
  const c = extraction.currency;
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <Field label="Vendor" value={extraction.vendorName} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <Field label="Vendor address" value={extraction.vendorAddress} />
        </div>
        <Field label="Invoice no." value={extraction.invoiceNumber} mono />
        <Field label="Invoice date" value={extraction.invoiceDate} mono />
        <Field label="Due date" value={extraction.dueDate} mono />
        <Field label="Currency" value={extraction.currency} mono />
      </dl>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <caption className="sr-only">Extracted line items</caption>
          <thead>
            <tr className="border-b-2 border-ink/70 text-left">
              <th className="w-8 py-2 pr-2 text-left font-mono text-[11px] font-normal uppercase tracking-wider text-ink-faint">
                Pos
              </th>
              <th className="py-2 pr-3 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                Description
              </th>
              <th className="py-2 pr-3 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                Qty
              </th>
              <th className="py-2 pr-3 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                Unit price
              </th>
              <th className="py-2 text-right text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {extraction.lineItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-ink-faint">
                  No line items found
                </td>
              </tr>
            ) : (
              extraction.lineItems.map((item, i) => (
                <tr key={i} className="border-b border-hairline">
                  <td className="py-2.5 pr-2 font-mono text-xs text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="py-2.5 pr-3 text-ink">
                    {item.description ?? <Dash />}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums text-ink">
                    {formatQty(item.quantity)}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums text-ink">
                    {formatMoney(item.unitPrice, c)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs tabular-nums text-ink">
                    {formatMoney(item.amount, c)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="ml-auto mt-5 max-w-sm space-y-2 text-sm">
        <div className="leader">
          <span className="leader-label text-ink-soft">Subtotal</span>
          <span className="leader-value font-mono tabular-nums text-ink">
            {formatMoney(extraction.subtotal, c)}
          </span>
        </div>
        <div className="leader">
          <span className="leader-label text-ink-soft">Tax / VAT</span>
          <span className="leader-value font-mono tabular-nums text-ink">
            {formatMoney(extraction.tax, c)}
          </span>
        </div>
        <div className="leader border-t-4 border-double border-ink/70 pt-2">
          <span className="leader-label font-display font-semibold text-ink">
            Total
          </span>
          <span className="leader-value font-mono text-base font-bold tabular-nums text-ledger-deep">
            {formatMoney(extraction.total, c)}
          </span>
        </div>
      </div>
    </div>
  );
}
