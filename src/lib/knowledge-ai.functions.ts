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

const CreativeInput = z.object({
  tool: z.enum([
    "rewrite",
    "summary",
    "social",
    "html",
    "flowchart",
    "graphic_brief",
    "image_prompt",
    "layout",
    "inclusivity_check",
  ]),
  assetContent: z.string().min(1).max(20000),
  currentOutput: z.string().max(20000).optional(),
  audience: z.string().min(1).max(80),
  format: z.string().min(1).max(80),
  tone: z.string().min(1).max(80),
  language: z.enum(["th", "en", "bilingual"]),
  instruction: z.string().max(2000).optional(),
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

const CREATIVE_PROMPTS: Record<
  z.infer<typeof CreativeInput>["tool"],
  { label: string; system: string }
> = {
  rewrite: {
    label: "Rewrite",
    system:
      "คุณคือบรรณาธิการ Knowledge Translation เขียนข้อความใหม่ให้กระชับ เข้าใจง่าย เคารพศักดิ์ศรี ใช้ inclusive language และคงข้อมูลสำคัญ ตอบกลับเป็น markdown",
  },
  summary: {
    label: "Summary",
    system:
      "คุณคือผู้สรุปความ ให้สรุปเนื้อหาเป็น bullet 3-6 ข้อ พร้อม key message 1 ประโยค ตอบเป็น markdown",
  },
  social: {
    label: "Social content",
    system:
      "คุณคือ social content writer สาย health & rights สร้าง caption 1 หลัก + 2 ทางเลือก + 5-8 hashtag + แนะนำภาพประกอบ 1 บรรทัด ตอบเป็น markdown",
  },
  html: {
    label: "HTML page",
    system:
      "คุณคือ frontend designer สร้างหน้า HTML เบื้องต้นแบบ semantic (h1, section, p, ul, blockquote) พร้อม inline Tailwind class ที่ดูสะอาด เข้าถึงง่าย ไม่ใส่ <script> หรือลิงก์ภายนอก ตอบเฉพาะ HTML ในบล็อก ```html ... ```",
  },
  flowchart: {
    label: "Flow chart",
    system:
      "คุณคือ instructional designer สร้าง flow chart เป็น mermaid syntax (flowchart TD) อธิบายขั้นตอนของเนื้อหา ตอบเฉพาะบล็อก ```mermaid ... ``` และมีคำอธิบายสั้นใต้บล็อก",
  },
  graphic_brief: {
    label: "Graphic brief",
    system:
      "คุณคือ art director เขียน brief ให้ดีไซเนอร์: objective, key message, audience, mood/tone, color palette แนะนำ, typography แนะนำ, key visual elements, do/don't ตอบเป็น markdown",
  },
  image_prompt: {
    label: "Image prompt",
    system:
      "คุณคือนักเขียน prompt ภาพ สร้าง prompt 3 ทางเลือก สำหรับ generative image model (อังกฤษ) เน้น representation ที่เคารพชุมชน หลีกเลี่ยง stereotype ระบุ style, composition, lighting, mood ตอบเป็น markdown 3 บล็อก",
  },
  layout: {
    label: "Visual layout",
    system:
      "คุณคือ UX/visual designer แนะนำ layout structure สำหรับสื่อที่กำลังทำ: ลำดับชั้น (hierarchy), grid, จุดสนใจ (focal point), CTA placement, mobile vs desktop หากเกี่ยวข้อง ตอบเป็น markdown bullet",
  },
  inclusivity_check: {
    label: "Inclusivity check",
    system:
      "คุณคือ language reviewer ด้านสิทธิและสุขภาพ ตรวจข้อความว่ามีคำ stigmatizing, gendered, ageist, ableist หรือไม่ ระบุ: 1) คำที่ควรเลี่ยง 2) คำที่แนะนำแทน 3) note สั้นๆ ตอบเป็น markdown ตาราง",
  },
};

export const creativeAssist = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CreativeInput.parse(i))
  .handler(async ({ data }) => {
    const spec = CREATIVE_PROMPTS[data.tool];
    const langInstruction =
      data.language === "bilingual"
        ? "เขียนผลลัพธ์เป็นสองภาษา ไทยก่อน อังกฤษตามด้านล่าง"
        : data.language === "en"
        ? "Write the result in English"
        : "เขียนผลลัพธ์เป็นภาษาไทย";
    const system = `${spec.system}
บริบท: audience=${data.audience} | format=${data.format} | tone=${data.tone}
${langInstruction}`;
    const userPrompt = `Instruction (optional):
${data.instruction ?? "-"}

---
Source content:
${data.assetContent}

${data.currentOutput ? `---\nCurrent draft (improve/extend if relevant):\n${data.currentOutput}` : ""}`;
    const text = await callLovableModel(system, userPrompt);
    return { tool: data.tool, label: spec.label, text: text.trim() };
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
