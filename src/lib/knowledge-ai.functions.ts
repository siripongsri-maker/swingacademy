import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AssistInput = z.object({
  mode: z.enum(["summarize", "translate", "simplify"]),
  text: z.string().min(1).max(20000),
  targetLang: z.enum(["th", "en"]).optional(),
});

const TranslateInput = z.object({
  assetContent: z.string().min(1).max(20000),
  audience: z.string().min(1).max(80),
  format: z.string().min(1).max(80),
  tone: z.string().min(1).max(80),
  language: z.enum(["th", "en", "bilingual"]),
  instruction: z.string().min(1).max(2000),
});

const SuggestInput = z.object({
  titleTh: z.string().max(300).optional(),
  titleEn: z.string().max(300).optional(),
  summary: z.string().max(2000).optional(),
  contentMd: z.string().max(20000).optional(),
  keyMessage: z.string().max(2000).optional(),
  availableCategories: z.array(z.string().max(80)).max(40),
  availableAudiences: z.array(z.string().max(80)).max(40),
});

const TalentSummaryInput = z.object({
  personName: z.string().min(1).max(200),
  personRole: z.string().max(200).optional(),
  personSite: z.string().max(200).optional(),
  mappings: z
    .array(
      z.object({
        assetTitle: z.string().max(300),
        domain: z.string().max(80).optional(),
        role: z.string().max(40),
        competencyTags: z.array(z.string().max(80)).max(20).optional(),
        evidenceCount: z.number().int().min(0).max(999),
        evidenceTypes: z.array(z.string().max(40)).max(20).optional(),
      }),
    )
    .min(1)
    .max(80),
});

async function callLovableModel(systemPrompt: string, userPrompt: string) {
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const { generateText } = await import("ai");
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI gateway is not configured (missing LOVABLE_API_KEY).");
  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway("google/gemini-3-flash-preview");
  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    });
    return text;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429")) throw new Error("ใช้ AI บ่อยเกินไป ลองอีกครั้งใน 1 นาที (rate limit)");
    if (msg.includes("402")) throw new Error("เครดิต AI หมด กรุณาเติมที่ Settings → Workspace → Usage");
    throw new Error(`AI error: ${msg}`);
  }
}

export const runKnowledgeAssist = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AssistInput.parse(i))
  .handler(async ({ data }) => {
    if (data.mode === "summarize") {
      const text = await callLovableModel(
        "คุณคือผู้ช่วยเขียน Key Message สำหรับงานสุขภาพและสิทธิ ให้สรุปเป็น 1-2 ประโยค สั้น ชัด ให้พลัง ไม่ตีตรา และเข้าใจง่าย",
        data.text,
      );
      return { text: text.trim() };
    }
    if (data.mode === "translate") {
      const target = data.targetLang === "en" ? "English" : "ภาษาไทย";
      const text = await callLovableModel(
        `คุณคือผู้แปลงานสุขภาพและสิทธิ ให้แปลข้อความต่อไปนี้เป็น${target} โดยรักษาความหมาย โทน inclusive ไม่ตีตรา และคงโครงสร้าง markdown ไว้`,
        data.text,
      );
      return { text: text.trim() };
    }
    const text = await callLovableModel(
      "คุณคือบรรณาธิการที่ทำให้เนื้อหาสุขภาพอ่านง่าย ใช้ประโยคสั้น คำพื้นฐาน หลีกเลี่ยงศัพท์เทคนิค เก็บโครงสร้าง markdown",
      data.text,
    );
    return { text: text.trim() };
  });

export const translateKnowledge = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TranslateInput.parse(i))
  .handler(async ({ data }) => {
    const langInstruction =
      data.language === "bilingual"
        ? "เขียนผลลัพธ์เป็นสองภาษา ไทยก่อน อังกฤษตามด้านล่าง"
        : data.language === "en"
        ? "Write the result in English"
        : "เขียนผลลัพธ์เป็นภาษาไทย";

    const system = `คุณคือนัก Knowledge Translation ที่เชี่ยวชาญงานสุขภาพและสิทธิของ SWING Academy
- กลุ่มเป้าหมาย: ${data.audience}
- รูปแบบที่ต้องการ: ${data.format}
- โทนภาษา: ${data.tone}
- ภาษา: ${data.language}
หลักการ:
1. เคารพศักดิ์ศรี ไม่ตีตรา ไม่ใช้คำที่ทำให้รู้สึกเป็นเหยื่อ
2. ใช้ภาษาที่อบอุ่น ชัดเจน เข้าถึงได้
3. มีหัวข้อหลัก key message และ call to action
4. รักษาความถูกต้องของข้อมูลสุขภาพ
${langInstruction}
ตอบกลับเป็น markdown ที่พร้อมใช้งาน`;

    const userPrompt = `Instruction จากผู้ใช้:
${data.instruction}

---
เนื้อหาต้นทาง:
${data.assetContent}`;

    const text = await callLovableModel(system, userPrompt);
    return { outputMd: text.trim() };
  });

export const suggestKnowledgeMeta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SuggestInput.parse(i))
  .handler(async ({ data }) => {
    const sys = `คุณคือบรรณาธิการความรู้ของ SWING Academy งานสุขภาพและสิทธิ
หน้าที่: แนะนำ metadata จากเนื้อหาที่ได้รับ
ตอบเป็น JSON เท่านั้น ไม่มีคำอธิบายอื่น โครงสร้าง:
{
  "categories": string[],          // เลือกจาก availableCategories (id)
  "audiences": string[],           // เลือกจาก availableAudiences (id)
  "tags": string[],                // 3-7 tag สั้น kebab-case
  "competencyTags": string[],      // 2-5 ทักษะ/competency ที่เกี่ยวข้อง
  "learningObjectives": string[]   // 3-5 ข้อ "ผู้เรียนสามารถ..."
}`;

    const user = `availableCategories: ${JSON.stringify(data.availableCategories)}
availableAudiences: ${JSON.stringify(data.availableAudiences)}

Title TH: ${data.titleTh ?? ""}
Title EN: ${data.titleEn ?? ""}
Summary: ${data.summary ?? ""}
Key Message: ${data.keyMessage ?? ""}
Content:
${data.contentMd ?? ""}`;

    const raw = await callLovableModel(sys, user);
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as {
        categories?: string[];
        audiences?: string[];
        tags?: string[];
        competencyTags?: string[];
        learningObjectives?: string[];
      };
      return {
        categories: (parsed.categories ?? []).filter((x) => data.availableCategories.includes(x)),
        audiences: (parsed.audiences ?? []).filter((x) => data.availableAudiences.includes(x)),
        tags: (parsed.tags ?? []).slice(0, 7),
        competencyTags: (parsed.competencyTags ?? []).slice(0, 5),
        learningObjectives: (parsed.learningObjectives ?? []).slice(0, 5),
      };
    } catch {
      throw new Error("AI ส่งข้อมูลกลับมาในรูปแบบที่อ่านไม่ได้ ลองอีกครั้ง");
    }
  });

export const summarizeTalent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TalentSummaryInput.parse(i))
  .handler(async ({ data }) => {
    const sys = `คุณคือผู้จัดการคน (people lead) ของ SWING Academy งานสุขภาพและสิทธิ
หน้าที่: สรุป talent profile ของเจ้าหน้าที่ จากรายการความรู้ที่เกี่ยวข้อง
ตอบเป็น JSON เท่านั้น ไม่มีคำอธิบายอื่น โครงสร้าง:
{
  "strengths": string[],     // 3-5 ด้านที่เก่ง (ภาษาไทย สั้น)
  "growAreas": string[],     // 2-4 ด้านที่ควรพัฒนาต่อ (ภาษาไทย สั้น)
  "summary": string          // 2-3 ประโยคสรุปบุคคลนี้ (ภาษาไทย)
}`;

    const user = `ชื่อ: ${data.personName}
ตำแหน่ง: ${data.personRole ?? "-"}
พื้นที่: ${data.personSite ?? "-"}

ความรู้ที่เกี่ยวข้อง (${data.mappings.length} รายการ):
${data.mappings
  .map(
    (m, i) =>
      `${i + 1}. ${m.assetTitle} — บทบาท ${m.role}${
        m.domain ? `, domain ${m.domain}` : ""
      }, evidence ${m.evidenceCount} ชิ้น${
        m.evidenceTypes && m.evidenceTypes.length ? ` (${m.evidenceTypes.join(", ")})` : ""
      }${m.competencyTags && m.competencyTags.length ? `, competency: ${m.competencyTags.join(", ")}` : ""}`,
  )
  .join("\n")}`;

    const raw = await callLovableModel(sys, user);
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as {
        strengths?: string[];
        growAreas?: string[];
        summary?: string;
      };
      return {
        strengths: (parsed.strengths ?? []).slice(0, 5),
        growAreas: (parsed.growAreas ?? []).slice(0, 4),
        summary: (parsed.summary ?? "").slice(0, 600),
      };
    } catch {
      throw new Error("AI ส่งข้อมูลกลับมาในรูปแบบที่อ่านไม่ได้ ลองอีกครั้ง");
    }
  });
