import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }): Promise<CaptureResult> => {
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText } = await import("ai");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway is not configured (missing LOVABLE_API_KEY).");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

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
                data: Buffer.from(data.audioBase64, "base64"),
                mediaType: data.audioMediaType,
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
      });

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

      return {
        transcript: String(p.transcript ?? ""),
        sections,
        summary: String(p.summary ?? ""),
        takeaways: Array.isArray(p.takeaways) ? p.takeaways.map(String) : [],
        actionPoints: Array.isArray(p.actionPoints) ? p.actionPoints.map(String) : [],
        tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) throw new Error("ใช้ AI บ่อยเกินไป ลองอีกครั้งใน 1 นาที (rate limit)");
      if (msg.includes("402")) throw new Error("เครดิต AI หมด กรุณาเติมที่ Settings → Workspace → Usage");
      throw new Error(`AI error: ${msg}`);
    }
  });
