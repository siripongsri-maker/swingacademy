import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireStaff } from "@/lib/auth-guards";

const AgendaItem = z.string().min(1).max(120);
const ManualNote = z.object({
  agendaIndex: z.number().int().min(0),
  text: z.string().min(1).max(2000),
  t: z.number().optional(),
});

const Input = z.object({
  sessionTitle: z.string().min(0).max(200).optional(),
  agenda: z.array(AgendaItem).min(1).max(20),
  manualNotes: z.array(ManualNote).max(200).default([]),
  audioBase64: z.string().min(100).max(35_000_000), // ~26MB binary
  audioMediaType: z.string().min(3).max(60),
  language: z.enum(["th", "en", "auto"]).default("auto"),
  // Optional link for ai_runs provenance (e.g. the saved capture session id).
  objectId: z.string().max(120).optional(),
});

export type CaptureResult = {
  transcript: string;
  sections: Array<{ title: string; content: string }>;
  summary: string;
  takeaways: string[];
  actionPoints: string[];
  tags: string[];
};

function tryParseJson(text: string): unknown | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const transcribeAndOrganize = createServerFn({ method: "POST" })
  .middleware([requireStaff])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }): Promise<CaptureResult> => {
    const { createAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { getAiConfig } = await import("@/lib/config.server");
    const { logAiRun } = await import("@/lib/ai-runs.server");
    const { generateText } = await import("ai");
    const ai = getAiConfig();
    if (!ai.apiKey) throw new Error(`AI gateway is not configured (missing ${ai.apiKeyEnvName}).`);
    const gateway = createAiGatewayProvider(ai);
    const model = gateway(ai.audioModel);

    const agendaList = data.agenda.map((a, i) => `${i + 1}. ${a}`).join("\n");
    const notesByAgenda = data.agenda.map((title, idx) => {
      const items = data.manualNotes.filter((n) => n.agendaIndex === idx);
      return items.length
        ? `### ${title}\n${items.map((n) => `- ${n.text}`).join("\n")}`
        : `### ${title}\n(ไม่มีบันทึกจากผู้ใช้)`;
    }).join("\n\n");

    const langInstr =
      data.language === "th"
        ? "ตอบกลับและถอดเสียงเป็นภาษาไทย"
        : data.language === "en"
        ? "Respond and transcribe in English"
        : "ใช้ภาษาเดียวกับที่พูดในเสียง (auto-detect) แต่ summary/takeaways/actions ให้เป็นภาษาเดียวกันทั้งหมด";

    const PROMPT_VERSION = "capture-v1";
    const system = `คุณคือผู้ช่วยจดบันทึกประชุม/อบรมของ SWING Academy
หน้าที่: 1) ถอดเสียง 2) จัดเนื้อหาตาม Agenda ที่ผู้ใช้กำหนด 3) สรุปประเด็นสำคัญ
- เคารพศักดิ์ศรี ไม่ตีตรา ใช้ภาษา inclusive
- ห้ามแต่งข้อมูลที่ไม่มีในเสียงหรือ notes
- ${langInstr}`;

    const userPrompt = `Session title: ${data.sessionTitle || "(ไม่ระบุ)"}

Agenda:
${agendaList}

Manual notes ที่ผู้ใช้พิมพ์ระหว่างบันทึก (จัดตาม agenda แล้ว):
${notesByAgenda}

โปรดทำสิ่งต่อไปนี้:
1. ถอดเสียงจากไฟล์เสียงที่แนบมาเป็นข้อความเต็ม (transcript)
2. จัดเนื้อหาเข้าตามแต่ละหัวข้อใน agenda — ใช้ทั้ง transcript และ manual notes
3. สรุปภาพรวม (summary, 2-4 ประโยค)
4. ดึง key takeaways (3-6 ข้อ, สั้น)
5. ดึง action points ที่ต้องทำต่อ (ถ้ามี)
6. แนะนำ tags ที่เหมาะ (3-8 คำ, lowercase, ภาษาอังกฤษ slug)

ตอบกลับเป็น JSON เท่านั้น ตาม schema นี้ ห้ามมีคำอธิบายเพิ่มเติม:
{
  "transcript": "string",
  "sections": [{"title": "string (ตรงกับ agenda)", "content": "string (markdown ได้)"}],
  "summary": "string",
  "takeaways": ["string", ...],
  "actionPoints": ["string", ...],
  "tags": ["string", ...]
}`;

    const audio = Buffer.from(data.audioBase64, "base64");
    // Provenance: input_hash is the SHA-256 of the audio bytes (audio itself is never
    // stored); input_chars is the length of the agenda/notes prompt sent with it.
    // The transcript is a verbatim copy of the audio, so it is never logged either
    // (only its length); ai_runs is readable by researchers and has no consent link.
    // Raw transcripts belong in the planned consent-gated research capture tables.
    const logRun = (entry: {
      status: "ok" | "error";
      latencyMs: number;
      outputJson?: unknown;
      error?: string | null;
    }) =>
      logAiRun(context.supabase, {
        userId: context.userId,
        purpose: "capture",
        objectType: data.objectId ? "capture_session" : null,
        objectId: data.objectId ?? null,
        model: ai.audioModel,
        baseUrlHost: ai.baseUrlHost,
        promptVersion: PROMPT_VERSION,
        params: {
          language: data.language,
          agendaCount: data.agenda.length,
          manualNoteCount: data.manualNotes.length,
          audioMediaType: data.audioMediaType,
          audioBytes: audio.byteLength,
        },
        inputBytes: audio,
        inputChars: userPrompt.length,
        ...entry,
      });

    const started = Date.now();
    let latencyMs: number | undefined;
    let rawText: string | undefined;
    try {
      const { text } = await generateText({
        model,
        system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: audio,
                mediaType: data.audioMediaType,
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
      });
      latencyMs = Date.now() - started;
      rawText = text;

      const parsed = tryParseJson(text);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("AI ตอบกลับไม่ใช่ JSON ที่อ่านได้");
      }
      const p = parsed as Record<string, unknown>;
      const sections = Array.isArray(p.sections)
        ? (p.sections as Array<Record<string, unknown>>).map((s) => ({
            title: String(s.title ?? ""),
            content: String(s.content ?? ""),
          }))
        : data.agenda.map((title) => ({ title, content: "" }));

      const result: CaptureResult = {
        transcript: String(p.transcript ?? ""),
        sections,
        summary: String(p.summary ?? ""),
        takeaways: Array.isArray(p.takeaways) ? p.takeaways.map(String) : [],
        actionPoints: Array.isArray(p.actionPoints) ? p.actionPoints.map(String) : [],
        tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
      };
      const { transcript, ...organized } = result;
      await logRun({
        status: "ok",
        latencyMs,
        outputJson: { ...organized, transcriptChars: transcript.length },
      });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // The raw model text contains the transcript, so only its length is kept.
      await logRun({
        status: "error",
        latencyMs: latencyMs ?? Date.now() - started,
        outputJson: rawText !== undefined ? { rawOutputChars: rawText.length } : null,
        error: msg,
      });
      if (msg.includes("429")) throw new Error("ใช้ AI บ่อยเกินไป ลองอีกครั้งใน 1 นาที (rate limit)");
      if (msg.includes("402")) throw new Error("เครดิต AI หมด กรุณาเติมที่ Settings → Workspace → Usage");
      throw new Error(`AI error: ${msg}`);
    }
  });
