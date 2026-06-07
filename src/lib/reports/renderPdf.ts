/** Worker-safe PDF renderer using pdf-lib.
 *
 * Pure layout from a ReportModel. No charts/images (deterministic only).
 * Returns a Uint8Array suitable for streaming, base64-encoding, or saving. */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ReportModel, ReportSection } from "./types";

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN = 54;
const LINE_HEIGHT = 14;
const COLOR_TEXT = rgb(0.1, 0.1, 0.12);
const COLOR_MUTED = rgb(0.42, 0.45, 0.5);
const COLOR_ACCENT = rgb(0.13, 0.32, 0.62);

type Ctx = {
  doc: PDFDocument;
  font: import("pdf-lib").PDFFont;
  bold: import("pdf-lib").PDFFont;
  page: import("pdf-lib").PDFPage;
  y: number;
};

function newPage(ctx: Ctx): Ctx {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
  return ctx;
}

function ensureSpace(ctx: Ctx, needed: number): Ctx {
  if (ctx.y - needed < MARGIN) newPage(ctx);
  return ctx;
}

function wrap(text: string, font: import("pdf-lib").PDFFont, size: number, maxW: number): string[] {
  const words = text.replace(/\s+/g, " ").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxW) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(
  ctx: Ctx,
  text: string,
  opts: { size?: number; color?: ReturnType<typeof rgb>; bold?: boolean } = {},
): void {
  const size = opts.size ?? 11;
  const color = opts.color ?? COLOR_TEXT;
  const font = opts.bold ? ctx.bold : ctx.font;
  const lines = wrap(text, font, size, PAGE_W - MARGIN * 2);
  for (const ln of lines) {
    ensureSpace(ctx, LINE_HEIGHT);
    ctx.page.drawText(ln, { x: MARGIN, y: ctx.y - size, size, font, color });
    ctx.y -= LINE_HEIGHT;
  }
}

function drawHeading(ctx: Ctx, text: string, level: 1 | 2 = 2): void {
  const size = level === 1 ? 20 : 14;
  ensureSpace(ctx, size + 10);
  ctx.y -= 6;
  ctx.page.drawText(text, {
    x: MARGIN,
    y: ctx.y - size,
    size,
    font: ctx.bold,
    color: COLOR_ACCENT,
  });
  ctx.y -= size + 8;
}

function drawKpis(ctx: Ctx, kpis: { label: string; value: string; hint?: string }[]): void {
  const cols = Math.min(4, kpis.length);
  const colW = (PAGE_W - MARGIN * 2) / cols;
  const cellH = 56;
  for (let i = 0; i < kpis.length; i += cols) {
    ensureSpace(ctx, cellH + 6);
    const top = ctx.y;
    for (let c = 0; c < cols && i + c < kpis.length; c++) {
      const k = kpis[i + c];
      const x = MARGIN + c * colW;
      ctx.page.drawRectangle({
        x,
        y: top - cellH,
        width: colW - 6,
        height: cellH,
        borderColor: rgb(0.85, 0.87, 0.9),
        borderWidth: 0.5,
        color: rgb(0.97, 0.98, 1),
      });
      ctx.page.drawText(k.label.toUpperCase(), {
        x: x + 8,
        y: top - 16,
        size: 8,
        font: ctx.bold,
        color: COLOR_MUTED,
      });
      ctx.page.drawText(k.value, {
        x: x + 8,
        y: top - 36,
        size: 16,
        font: ctx.bold,
        color: COLOR_TEXT,
      });
      if (k.hint) {
        ctx.page.drawText(k.hint, {
          x: x + 8,
          y: top - 50,
          size: 8,
          font: ctx.font,
          color: COLOR_MUTED,
        });
      }
    }
    ctx.y = top - cellH - 8;
  }
}

function drawTable(ctx: Ctx, columns: string[], rows: string[][]): void {
  const colW = (PAGE_W - MARGIN * 2) / columns.length;
  const rowH = 18;
  ensureSpace(ctx, rowH * (rows.length + 1));
  // Header
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - rowH,
    width: PAGE_W - MARGIN * 2,
    height: rowH,
    color: rgb(0.93, 0.95, 0.98),
  });
  columns.forEach((c, i) => {
    ctx.page.drawText(c, {
      x: MARGIN + i * colW + 6,
      y: ctx.y - rowH + 5,
      size: 9,
      font: ctx.bold,
      color: COLOR_TEXT,
    });
  });
  ctx.y -= rowH;
  for (const row of rows) {
    ensureSpace(ctx, rowH);
    row.forEach((cell, i) => {
      const text = String(cell ?? "");
      const max = colW - 12;
      const truncated =
        ctx.font.widthOfTextAtSize(text, 9) > max
          ? truncateToWidth(text, ctx.font, 9, max)
          : text;
      ctx.page.drawText(truncated, {
        x: MARGIN + i * colW + 6,
        y: ctx.y - rowH + 5,
        size: 9,
        font: ctx.font,
        color: COLOR_TEXT,
      });
    });
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y - rowH },
      end: { x: PAGE_W - MARGIN, y: ctx.y - rowH },
      thickness: 0.25,
      color: rgb(0.88, 0.9, 0.93),
    });
    ctx.y -= rowH;
  }
  ctx.y -= 6;
}

function truncateToWidth(
  text: string,
  font: import("pdf-lib").PDFFont,
  size: number,
  maxW: number,
): string {
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxW) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

function drawBullets(ctx: Ctx, items: string[]): void {
  for (const item of items) {
    const lines = wrap(item, ctx.font, 11, PAGE_W - MARGIN * 2 - 14);
    ensureSpace(ctx, LINE_HEIGHT * lines.length);
    lines.forEach((ln, i) => {
      if (i === 0) {
        ctx.page.drawText("•", {
          x: MARGIN,
          y: ctx.y - 11,
          size: 11,
          font: ctx.bold,
          color: COLOR_ACCENT,
        });
      }
      ctx.page.drawText(ln, {
        x: MARGIN + 14,
        y: ctx.y - 11,
        size: 11,
        font: ctx.font,
        color: COLOR_TEXT,
      });
      ctx.y -= LINE_HEIGHT;
    });
  }
  ctx.y -= 4;
}

function drawSection(ctx: Ctx, s: ReportSection): void {
  drawHeading(ctx, s.heading, 2);
  switch (s.type) {
    case "kpis":
      drawKpis(ctx, s.kpis);
      break;
    case "table":
      drawTable(ctx, s.columns, s.rows);
      break;
    case "bullets":
      drawBullets(ctx, s.items);
      break;
    case "narrative":
      drawParagraph(ctx, s.text && s.text.length > 0 ? s.text : "(No narrative generated.)");
      break;
  }
}

function drawCitations(ctx: Ctx, report: ReportModel): void {
  if (report.citations.length === 0) return;
  drawHeading(ctx, "Citations", 2);
  for (const c of report.citations) {
    drawParagraph(ctx, `[${c.source}] ${c.ref}`, { size: 9, color: COLOR_MUTED });
  }
}

function drawFooter(ctx: Ctx, report: ReportModel): void {
  // Footer on every page.
  const text = report.footer;
  const pages = ctx.doc.getPages();
  pages.forEach((p, idx) => {
    const lines = wrap(text, ctx.font, 7.5, PAGE_W - MARGIN * 2);
    let y = MARGIN - 18;
    for (const ln of lines) {
      p.drawText(ln, { x: MARGIN, y, size: 7.5, font: ctx.font, color: COLOR_MUTED });
      y -= 10;
    }
    p.drawText(`Page ${idx + 1} of ${pages.length}`, {
      x: PAGE_W - MARGIN - 60,
      y: MARGIN - 28,
      size: 7.5,
      font: ctx.font,
      color: COLOR_MUTED,
    });
  });
}

export async function renderReportPdf(report: ReportModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = {
    doc,
    font,
    bold,
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
  };

  // Title block
  drawHeading(ctx, report.title, 1);
  drawParagraph(
    ctx,
    `Generated ${new Date(report.generatedAt).toUTCString()}  ·  Risk ${report.risk.score}/100 (${report.risk.level})`,
    { size: 9, color: COLOR_MUTED },
  );
  ctx.y -= 6;

  for (const s of report.sections) drawSection(ctx, s);

  drawCitations(ctx, report);
  drawFooter(ctx, report);

  return doc.save();
}
