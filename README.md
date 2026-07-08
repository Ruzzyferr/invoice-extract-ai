# Invoice Extract AI

Stop retyping invoices. Upload a PDF or a photo of an invoice — or paste its raw text — and get clean, structured data back: vendor, dates, line items, totals. Export the result to CSV in one click.

**Live demo:** https://invoice-extract-ai.vercel.app

Built as a demo for accounting and back-office automation: the same pattern applies to receipts, purchase orders, delivery notes and any other semi-structured document your team currently copies into a spreadsheet by hand.

## Features

- **Two input modes**
  - Upload a PDF, PNG or JPG (drag & drop or file picker, up to 4 MB)
  - Paste invoice text — two realistic samples are bundled (a German B2B invoice with 19% VAT and a US-style one)
- **Structured extraction** — vendor name and address, invoice number, invoice date, due date, currency, a line items table (description, quantity, unit price, amount), subtotal, tax/VAT and total. Fields the model can't find are shown as "—", never guessed.
- **CSV export** — download the line items and totals as a CSV that opens cleanly in Excel. Generated entirely in the browser, no extra dependencies.
- **Graceful demo mode** — if no API key is configured or the upstream call fails (quota, timeout), the app returns a realistic sample extraction and shows a clear "Demo mode" badge instead of an error screen.

## How it works

1. The browser reads your file as base64 (or takes your pasted text) and sends it to a server-side API route — your API key never reaches the client.
2. The route calls the Google Gemini REST API (`gemini-2.5-flash`, with a fallback to `gemini-2.0-flash`). Files are sent as multimodal `inlineData`, so Gemini reads PDFs and images directly — no OCR step needed.
3. The prompt pins down a strict JSON schema and the request sets `responseMimeType: "application/json"`, so the model returns machine-readable output. The server validates and sanitizes every field before responding.
4. If anything goes wrong upstream, the route degrades to a canned sample response flagged with `mock: true`, and the UI labels it accordingly.

No document data is stored anywhere — requests are processed in memory and discarded.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, TypeScript)
- [Tailwind CSS 4](https://tailwindcss.com/)
- Google Gemini REST API (multimodal, JSON output)
- No database, no file storage, no client-side AI SDK

## Run locally

```bash
git clone https://github.com/Ruzzyferr/invoice-extract-ai.git
cd invoice-extract-ai
npm install
cp .env.example .env.local   # then add your key (see below)
npm run dev
```

Open http://localhost:3000.

## Environment

| Variable         | Description                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY` | Google AI Studio API key ([get one here](https://aistudio.google.com/apikey)). Optional — without it the app runs in demo mode with a sample response. |

## About

Built by [Ruzzyferr](https://github.com/Ruzzyferr) — full-stack & AI integration developer.
