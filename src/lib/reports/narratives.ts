/** AI narrative generator.
 *
 * Receives a deterministic ReportModel and an AIProvider, and fills the
 * `text` field on each narrative section by asking the provider one prompt
 * per slot. The deterministic fields (KPIs, tables, bullets, risk, citations)
 * are never touched. */

import { renderEvidence, SYSTEM_PROMPT } from "../ai/prompts";
import type { EvidencePackage } from "../ai/retrieval";
import type { AIProvider } from "../ai/providers";
import type { ReportModel, ReportSection } from "./types";

export interface GenerateNarrativesInput {
  report: ReportModel;
  pkg: EvidencePackage;
  provider: AIProvider;
}

export interface GenerateNarrativesResult {
  /** Mutated copy of the report with narrative.text filled in. */
  report: ReportModel;
  /** slot → generated text. */
  narratives: Record<string, string>;
  model: string;
  provider: string;
}

const FALLBACK = "(No narrative could be generated for this section.)";

function isNarrativeSection(
  s: ReportSection,
): s is Extract<ReportSection, { type: "narrative" }> {
  return s.type === "narrative";
}

export async function generateNarratives(
  input: GenerateNarrativesInput,
): Promise<GenerateNarrativesResult> {
  const { report, pkg, provider } = input;

  // Evidence + grounding rules shared by every narrative call.
  const evidenceBlock = renderEvidence(pkg);
  const groundingRules =
    "You are filling a single narrative section inside a deterministically built report.\n" +
    "Constraints:\n" +
    "- Use ONLY values that appear in the EVIDENCE block below.\n" +
    "- Do NOT invent metrics, percentages, timestamps, anomaly counts, or causal claims.\n" +
    "- Keep the paragraph short (2–5 sentences) and in plain English.\n" +
    "- If the evidence is insufficient to write the section, say so explicitly in one sentence.";

  const out: Record<string, string> = {};
  const slots = report.sections.filter(isNarrativeSection);
  for (const slot of slots) {
    const userPrompt =
      `Report: ${report.title}\n` +
      `Section: ${slot.heading}\n` +
      `Instruction: ${slot.prompt}\n\n` +
      `${evidenceBlock}`;
    let text = FALLBACK;
    try {
      const res = await provider.chat(
        [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n${groundingRules}` },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.2, maxTokens: 400 },
      );
      const trimmed = res.content.trim();
      if (trimmed.length > 0) text = trimmed;
    } catch {
      // Swallow: a narrative failure must not break the whole report.
      text = FALLBACK;
    }
    out[slot.slot] = text;
  }

  // Apply to a copy of the report so callers can compare before/after.
  const next: ReportModel = {
    ...report,
    sections: report.sections.map((s) =>
      isNarrativeSection(s) ? { ...s, text: out[s.slot] ?? FALLBACK } : s,
    ),
  };

  return {
    report: next,
    narratives: out,
    model: provider.model,
    provider: provider.name,
  };
}
