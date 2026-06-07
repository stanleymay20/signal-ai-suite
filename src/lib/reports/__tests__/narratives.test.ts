import { describe, expect, it, vi } from "vitest";
import { buildReport } from "../buildReport";
import { generateNarratives } from "../narratives";
import type { AIProvider } from "../../ai/providers";
import { fullPkg } from "./_fixtures";

function fakeProvider(stub: (prompt: string) => string, fail = false): AIProvider {
  return {
    name: "fake",
    model: "fake-1",
    chat: vi.fn(async (messages) => {
      if (fail) throw new Error("provider down");
      const user = messages[messages.length - 1]?.content ?? "";
      return {
        content: stub(user),
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        model: "fake-1",
        provider: "fake",
      };
    }),
  };
}

describe("generateNarratives", () => {
  it("fills text on every narrative slot without mutating deterministic sections", async () => {
    const base = buildReport({ type: "boardroom", pkg: fullPkg() });
    const before = JSON.stringify(
      base.sections.filter((s) => s.type !== "narrative"),
    );
    const out = await generateNarratives({
      report: base,
      pkg: fullPkg(),
      provider: fakeProvider((u) => `Synthesized: ${u.slice(0, 20)}`),
    });
    const after = JSON.stringify(
      out.report.sections.filter((s) => s.type !== "narrative"),
    );
    // KPIs/tables/bullets are not touched.
    expect(after).toBe(before);

    // Every narrative slot received text.
    for (const s of out.report.sections) {
      if (s.type === "narrative") {
        expect(typeof s.text).toBe("string");
        expect(s.text!.length).toBeGreaterThan(0);
      }
    }
    expect(out.model).toBe("fake-1");
    expect(out.provider).toBe("fake");
  });

  it("passes evidence + grounding rules in the prompt sent to the provider", async () => {
    const base = buildReport({ type: "executive_summary", pkg: fullPkg() });
    const provider = fakeProvider(() => "ok");
    await generateNarratives({ report: base, pkg: fullPkg(), provider });
    const calls = (provider.chat as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const messages = calls[0][0] as Array<{ role: string; content: string }>;
    const system = messages[0];
    const user = messages[1];
    expect(system.role).toBe("system");
    // Grounding rules live in the system message.
    expect(system.content).toMatch(/do not invent/i);
    // Evidence (dataset name + EVIDENCE marker) is in the user message.
    expect(user.role).toBe("user");
    expect(user.content).toContain("sales.csv");
    expect(user.content).toContain("PROFILE:");
  });

  it("falls back gracefully when the provider throws", async () => {
    const base = buildReport({ type: "risk_brief", pkg: fullPkg() });
    const out = await generateNarratives({
      report: base,
      pkg: fullPkg(),
      provider: fakeProvider(() => "", true),
    });
    // Deterministic sections untouched.
    const drivers = out.report.sections.find(
      (s) => s.type === "bullets" && s.heading.startsWith("Risk Drivers"),
    );
    expect(drivers).toBeTruthy();
    // Narrative slots filled with the fallback.
    for (const s of out.report.sections) {
      if (s.type === "narrative") {
        expect(s.text).toMatch(/No narrative could be generated/);
      }
    }
  });
});
