export type Sample = {
  id: string;
  label: string;
  hint: string;
  text: string;
};

export const SAMPLES: Sample[] = [
  {
    id: "de-b2b",
    label: "German B2B invoice",
    hint: "EUR · 19% VAT · net 30",
    text: `MUSTERMANN BÜROTECHNIK GMBH
Lindenstraße 24, 80331 München, Deutschland
USt-IdNr.: DE 812 345 678

RECHNUNG

Rechnungsnummer: RE-2026-0447
Rechnungsdatum: 12.06.2026
Fällig bis: 12.07.2026 (30 Tage netto)

Rechnungsempfänger:
Baumann Consulting UG
Hafenweg 8
20457 Hamburg

Pos  Beschreibung                          Menge  Einzelpreis     Gesamt
1    Ergonomischer Bürostuhl "Komfort"         4     289,00 €  1.156,00 €
2    Schreibtisch, höhenverstellbar            2     549,50 €  1.099,00 €
3    Monitorarm Dual                           4      79,90 €    319,60 €
4    Lieferung und Montage                     1     180,00 €    180,00 €

Zwischensumme (netto):     2.754,60 €
Umsatzsteuer 19 %:           523,37 €
Rechnungsbetrag (brutto):  3.277,97 €

Zahlbar innerhalb von 30 Tagen ohne Abzug.
IBAN: DE89 3704 0044 0532 0130 00 · BIC: COBADEFFXXX`,
  },
  {
    id: "us-net30",
    label: "US invoice",
    hint: "USD · sales tax · net 30",
    text: `NORTHWIND SUPPLY CO.
412 Harrison Ave, Suite 300
Boston, MA 02118, USA

INVOICE

Invoice #: INV-10592
Invoice date: June 18, 2026
Due date: July 18, 2026 (Net 30)

Bill to:
Cedar & Pine Interiors LLC
88 Mercer Street
New York, NY 10012

Description                           Qty    Unit price      Amount
Oak shelving unit, 72"                  6       $415.00   $2,490.00
Wall-mount bracket set                 12        $18.50     $222.00
White-glove delivery                    1       $150.00     $150.00

Subtotal:             $2,862.00
Sales tax (6.25%):      $178.88
Total due:            $3,040.88

Payment terms: Net 30. Please reference the invoice number on payment.`,
  },
];
