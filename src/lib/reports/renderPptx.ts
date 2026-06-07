/** Worker-safe PPTX renderer using pptxgenjs.
 *
 * Slide layout from a ReportModel. Returns a Uint8Array. */

import pptxgen from "pptxgenjs";
import type { ReportModel, ReportSection } from "./types";
import { BRAND_LOGO_PNG_BASE64, BRAND_NAME, BRAND_TAGLINE } from "./brandLogo";

const LOGO_DATA_URL = `data:image/png;base64,${BRAND_LOGO_PNG_BASE64}`;

const SLIDE_W = 13.333; // 16:9 inches
const SLIDE_H = 7.5;
const ACCENT = "215AC9";
const MUTED = "6B7280";
const TEXT = "111827";
const BG_SOFT = "F8FAFC";

function addSlideHeader(slide: pptxgen.Slide, title: string, subtitle?: string): void {
  slide.addText(title, {
    x: 0.5,
    y: 0.3,
    w: SLIDE_W - 1,
    h: 0.55,
    fontSize: 24,
    bold: true,
    color: ACCENT,
    fontFace: "Calibri",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5,
      y: 0.88,
      w: SLIDE_W - 1,
      h: 0.3,
      fontSize: 11,
      color: MUTED,
      fontFace: "Calibri",
    });
  }
}

function addFooter(slide: pptxgen.Slide, footer: string): void {
  slide.addText(footer, {
    x: 0.5,
    y: SLIDE_H - 0.45,
    w: SLIDE_W - 1,
    h: 0.4,
    fontSize: 7,
    color: MUTED,
    italic: true,
    fontFace: "Calibri",
  });
}

function renderSectionSlide(pres: pptxgen, report: ReportModel, section: ReportSection): void {
  const slide = pres.addSlide();
  slide.background = { color: "FFFFFF" };
  addSlideHeader(slide, section.heading, report.title);

  const top = 1.4;
  const left = 0.5;
  const w = SLIDE_W - 1;

  switch (section.type) {
    case "kpis": {
      const cols = Math.min(4, section.kpis.length);
      const cellW = w / cols;
      const cellH = 1.4;
      section.kpis.forEach((k, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = left + col * cellW;
        const y = top + row * (cellH + 0.2);
        slide.addShape(pres.ShapeType.rect, {
          x,
          y,
          w: cellW - 0.15,
          h: cellH,
          fill: { color: BG_SOFT },
          line: { color: "E5E7EB", width: 0.5 },
        });
        slide.addText(k.label.toUpperCase(), {
          x: x + 0.1,
          y: y + 0.1,
          w: cellW - 0.35,
          h: 0.3,
          fontSize: 9,
          bold: true,
          color: MUTED,
          fontFace: "Calibri",
        });
        slide.addText(k.value, {
          x: x + 0.1,
          y: y + 0.4,
          w: cellW - 0.35,
          h: 0.6,
          fontSize: 22,
          bold: true,
          color: TEXT,
          fontFace: "Calibri",
        });
        if (k.hint) {
          slide.addText(k.hint, {
            x: x + 0.1,
            y: y + 1.0,
            w: cellW - 0.35,
            h: 0.3,
            fontSize: 8,
            color: MUTED,
            fontFace: "Calibri",
          });
        }
      });
      break;
    }
    case "table": {
      const rows: pptxgen.TableRow[] = [
        section.columns.map((c) => ({
          text: c,
          options: { bold: true, color: "FFFFFF", fill: { color: ACCENT }, fontSize: 11 },
        })),
        ...section.rows.map((r) =>
          r.map((cell) => ({
            text: String(cell ?? ""),
            options: { color: TEXT, fontSize: 10 },
          })),
        ),
      ];
      slide.addTable(rows, {
        x: left,
        y: top,
        w,
        fontFace: "Calibri",
        border: { type: "solid", color: "E5E7EB", pt: 0.5 },
      });
      break;
    }
    case "bullets": {
      slide.addText(
        section.items.map((t) => ({ text: t, options: { bullet: true } })),
        {
          x: left,
          y: top,
          w,
          h: SLIDE_H - top - 0.8,
          fontSize: 14,
          color: TEXT,
          fontFace: "Calibri",
          valign: "top",
        },
      );
      break;
    }
    case "narrative": {
      slide.addText(
        section.text && section.text.length > 0 ? section.text : "(No narrative generated.)",
        {
          x: left,
          y: top,
          w,
          h: SLIDE_H - top - 0.8,
          fontSize: 14,
          color: TEXT,
          fontFace: "Calibri",
          valign: "top",
        },
      );
      break;
    }
  }

  addFooter(slide, report.footer);
}

function renderTitleSlide(pres: pptxgen, report: ReportModel): void {
  const slide = pres.addSlide();
  slide.background = { color: ACCENT };
  slide.addImage({ data: LOGO_DATA_URL, x: 0.6, y: 0.6, w: 1.1, h: 1.1 });
  slide.addText(BRAND_NAME, {
    x: 1.85,
    y: 0.75,
    w: SLIDE_W - 2.5,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: "FFFFFF",
    fontFace: "Calibri",
  });
  slide.addText(BRAND_TAGLINE, {
    x: 1.85,
    y: 1.25,
    w: SLIDE_W - 2.5,
    h: 0.35,
    fontSize: 11,
    color: "DBE3FF",
    fontFace: "Calibri",
  });
  slide.addText(report.title, {
    x: 0.6,
    y: 2.6,
    w: SLIDE_W - 1.2,
    h: 1.4,
    fontSize: 34,
    bold: true,
    color: "FFFFFF",
    fontFace: "Calibri",
  });
  slide.addText(
    `Generated ${new Date(report.generatedAt).toUTCString()}\nRisk ${report.risk.score}/100 — ${report.risk.level}`,
    {
      x: 0.6,
      y: 4.0,
      w: SLIDE_W - 1.2,
      h: 1.0,
      fontSize: 16,
      color: "DBE3FF",
      fontFace: "Calibri",
    },
  );
  slide.addText(report.footer, {
    x: 0.6,
    y: SLIDE_H - 0.7,
    w: SLIDE_W - 1.2,
    h: 0.5,
    fontSize: 8,
    color: "DBE3FF",
    italic: true,
    fontFace: "Calibri",
  });
}

function renderCitationsSlide(pres: pptxgen, report: ReportModel): void {
  if (report.citations.length === 0) return;
  const slide = pres.addSlide();
  slide.background = { color: "FFFFFF" };
  addSlideHeader(slide, "Citations", report.title);
  const items = report.citations.map((c) => ({
    text: `[${c.source}] ${c.ref}`,
    options: { bullet: true },
  }));
  slide.addText(items, {
    x: 0.5,
    y: 1.4,
    w: SLIDE_W - 1,
    h: SLIDE_H - 2.2,
    fontSize: 11,
    color: TEXT,
    fontFace: "Calibri",
    valign: "top",
  });
  addFooter(slide, report.footer);
}

export async function renderReportPptx(report: ReportModel): Promise<Uint8Array> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = report.title;
  pres.author = "Signal AI Suite";

  renderTitleSlide(pres, report);
  for (const s of report.sections) renderSectionSlide(pres, report, s);
  renderCitationsSlide(pres, report);

  const out = (await pres.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return new Uint8Array(out);
}
