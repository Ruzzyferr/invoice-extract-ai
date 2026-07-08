import { NextResponse } from "next/server";
import { MOCK_EXTRACTION } from "@/lib/mock";
import type { Extraction, ExtractResponse, LineItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB raw file size
const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const GEMINI_TIMEOUT_MS = 45_000;
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";

const EXTRACTION_PROMPT = `You are an invoice data extraction engine. Extract structured data from the invoice provided (as document/image or as raw text).

Return ONLY a JSON object with exactly this shape (no markdown, no commentary):
{
  "vendorName": string | null,        // issuing company name
  "vendorAddress": string | null,     // issuing company address, single line, comma-separated
  "invoiceNumber": string | null,
  "invoiceDate": string | null,       // format YYYY-MM-DD when determinable, otherwise as printed
  "dueDate": string | null,           // format YYYY-MM-DD when determinable, otherwise as printed
  "currency": string | null,          // ISO 4217 code, e.g. "EUR", "USD"
  "lineItems": [
    {
      "description": string | null,
      "quantity": number | null,
      "unitPrice": number | null,     // plain number, no currency symbols or thousands separators
      "amount": number | null
    }
  ],
  "subtotal": number | null,          // pre-tax subtotal
  "tax": number | null,               // total tax / VAT amount
  "total": number | null              // grand total
}

Rules:
- Use null for any field not present in the document. Never invent values.
- All monetary values must be plain decimal numbers (e.g. 1156.00 -> 1156), respecting the document's locale (German "1.156,00" means 1156.00).
- lineItems must be an array; use [] if no line items are identifiable.`;

type RequestBody = {
  mode?: "file" | "text";
  text?: string;
  fileBase64?: string;
  mimeType?: string;
};

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

function mockResponse(): NextResponse<ExtractResponse> {
  return NextResponse.json({ extraction: MOCK_EXTRACTION, mock: true });
}

function toStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n) && v.trim() !== "") return n;
  }
  return null;
}

function sanitize(raw: unknown): Extraction {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const items: LineItem[] = Array.isArray(obj.lineItems)
    ? obj.lineItems.slice(0, 200).map((item) => {
        const it = (item && typeof item === "object" ? item : {}) as Record<
          string,
          unknown
        >;
        return {
          description: toStr(it.description),
          quantity: toNum(it.quantity),
          unitPrice: toNum(it.unitPrice),
          amount: toNum(it.amount),
        };
      })
    : [];
  return {
    vendorName: toStr(obj.vendorName),
    vendorAddress: toStr(obj.vendorAddress),
    invoiceNumber: toStr(obj.invoiceNumber),
    invoiceDate: toStr(obj.invoiceDate),
    dueDate: toStr(obj.dueDate),
    currency: toStr(obj.currency),
    lineItems: items,
    subtotal: toNum(obj.subtotal),
    tax: toNum(obj.tax),
    total: toNum(obj.total),
  };
}

async function callGemini(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
  signal: AbortSignal
): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
      signal,
    }
  );
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parts: GeminiPart[] = [{ text: EXTRACTION_PROMPT }];

  if (body.mode === "file") {
    const mimeType = body.mimeType ?? "";
    const data = body.fileBase64 ?? "";
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, PNG or JPG." },
        { status: 400 }
      );
    }
    // base64 is ~4/3 of the raw size
    if (!data || data.length > (MAX_FILE_BYTES * 4) / 3 + 4) {
      return NextResponse.json(
        { error: "File is missing or larger than 4MB." },
        { status: 400 }
      );
    }
    parts.push({ inlineData: { mimeType, data } });
  } else if (body.mode === "text") {
    const text = (body.text ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "No invoice text provided." },
        { status: 400 }
      );
    }
    parts.push({ text: `Invoice text:\n\n${text.slice(0, 40_000)}` });
  } else {
    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return mockResponse();

  try {
    const signal = AbortSignal.timeout(GEMINI_TIMEOUT_MS);
    let model = PRIMARY_MODEL;
    let res = await callGemini(apiKey, model, parts, signal);
    if (res.status === 404) {
      model = FALLBACK_MODEL;
      res = await callGemini(apiKey, model, parts, signal);
    }
    if (!res.ok) return mockResponse();

    const payload = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const rawText = payload.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("");
    if (!rawText) return mockResponse();

    // Defensive: strip markdown fences in case the model wraps its output.
    const jsonText = rawText.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const extraction = sanitize(JSON.parse(jsonText));
    return NextResponse.json({ extraction, mock: false, model });
  } catch {
    // Timeout, network failure, quota, malformed JSON — degrade gracefully.
    return mockResponse();
  }
}
