export type LineItem = {
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
};

export type Extraction = {
  vendorName: string | null;
  vendorAddress: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string | null;
  lineItems: LineItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
};

export type ExtractResponse = {
  extraction: Extraction;
  mock: boolean;
  model?: string;
};
