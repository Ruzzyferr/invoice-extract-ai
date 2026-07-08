import type { Extraction } from "./types";

/**
 * Canned extraction returned when no GEMINI_API_KEY is configured or the
 * upstream call fails. Matches the bundled German sample invoice so the
 * demo stays coherent.
 */
export const MOCK_EXTRACTION: Extraction = {
  vendorName: "Mustermann Bürotechnik GmbH",
  vendorAddress: "Lindenstraße 24, 80331 München, Deutschland",
  invoiceNumber: "RE-2026-0447",
  invoiceDate: "2026-06-12",
  dueDate: "2026-07-12",
  currency: "EUR",
  lineItems: [
    {
      description: 'Ergonomischer Bürostuhl "Komfort"',
      quantity: 4,
      unitPrice: 289.0,
      amount: 1156.0,
    },
    {
      description: "Schreibtisch, höhenverstellbar",
      quantity: 2,
      unitPrice: 549.5,
      amount: 1099.0,
    },
    {
      description: "Monitorarm Dual",
      quantity: 4,
      unitPrice: 79.9,
      amount: 319.6,
    },
    {
      description: "Lieferung und Montage",
      quantity: 1,
      unitPrice: 180.0,
      amount: 180.0,
    },
  ],
  subtotal: 2754.6,
  tax: 523.37,
  total: 3277.97,
};
