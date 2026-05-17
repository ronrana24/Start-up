import type { Order, OrderStatus } from "@domain/order";
import { formatMoney } from "@presentation/lib/format-money";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

/** Fixed locale for deterministic PDF text (matches formatMoney). */
const PDF_LOCALE = "en-US";

export type DownloadOrderInvoicePdfOptions = {
  vendorName?: string;
  filenamePrefix?: string;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  assigned: "Rider assigned",
  picked_up: "Picked up",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
};

function formatInvoiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString(PDF_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function sanitizeFilenamePart(id: string): string {
  const s = id.replace(/[^a-zA-Z0-9._-]+/g, "_").trim();
  return s.slice(0, 80) || "order";
}

type JsPdfWithTable = InstanceType<typeof jsPDF> & {
  lastAutoTable?: { finalY: number };
};

/**
 * Builds and downloads a PDF invoice/receipt for the given order (client-only).
 */
export function downloadOrderInvoicePdf(
  order: Order,
  options?: DownloadOrderInvoicePdfOptions,
): void {
  const vendor = options?.vendorName ?? "Dispense.";
  const prefix = options?.filenamePrefix ?? "Dispense-invoice";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(31, 122, 99);
  doc.text(vendor, margin, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("Invoice / Receipt", margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text(`Order ID: ${order.id}`, margin, y);
  y += 6;
  doc.text(`Date: ${formatInvoiceDate(order.createdAt)}`, margin, y);
  y += 6;
  doc.text(`Status: ${STATUS_LABELS[order.status]}`, margin, y);
  y += 10;

  const body =
    order.lines.length === 0
      ? [["—", "No line items", "0", formatMoney(0), formatMoney(0)]]
      : order.lines.map((l) => [
          l.productId,
          l.title,
          String(l.quantity),
          formatMoney(l.unitPriceCents),
          formatMoney(l.unitPriceCents * l.quantity),
        ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["SKU", "Description", "Qty", "Unit price", "Line total"]],
    body,
    styles: {
      fontSize: 9,
      cellPadding: 1.5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [31, 122, 99],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 62 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 26, halign: "right" },
    },
  });

  const docWithTable = doc as JsPdfWithTable;
  const tableBottom = docWithTable.lastAutoTable?.finalY ?? y + 24;
  const totalY = tableBottom + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text("Total", margin, totalY);
  doc.text(formatMoney(order.totalCents), pageW - margin, totalY, {
    align: "right",
  });

  const filename = `${prefix}-${sanitizeFilenamePart(order.id)}.pdf`;
  doc.save(filename);
}
