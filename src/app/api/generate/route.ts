import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = "http://localhost:18789/v1/chat/completions";
const GATEWAY_TOKEN = "0c561aa6c8b166fce61402c0f6b9b78a5d239416c52cea2c";

interface GenerateRequest {
  common_name: string;
  scientific_name: string;
  iconic_taxon_name: string;
  wikipedia_summary: string;
  place_name: string;
  current_month: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();

    const prompt = `你是一个儿童自然教育专家。请为以下物种生成一段适合3岁中国孩子的亲子知识内容。

物种：${body.common_name} (${body.scientific_name})
类别：${body.iconic_taxon_name}
Wikipedia简介：${body.wikipedia_summary || "无"}
地点：${body.place_name}
月份：${body.current_month}月

请严格按以下JSON格式输出（中文），不要输出其他内容，不要用markdown代码块包裹：
{
  "description": "一段可以跟孩子讲的有趣内容，包含这个物种独特的习性和有趣的秘密，语气温暖自然，像家长在跟孩子聊天，4-6句话，可以包含一个互动引导"
}

要求：语气温暖有趣，多用拟人化和比喻，适合3岁理解力。可以适当使用emoji。`;

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-5",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gateway error:", res.status, errText);
      return NextResponse.json({ error: "Gateway error" }, { status: 500 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "No content generated" }, { status: 500 });
    }

    // Extract JSON robustly from LLM response
    let jsonStr = content.trim();
    // Strip markdown code fences
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```$/i, "");
    // Find first { and last } to extract JSON object
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start === -1 || end === -1) {
      console.error("No JSON object found in:", content);
      return NextResponse.json({ error: "Invalid response format" }, { status: 500 });
    }
    jsonStr = jsonStr.slice(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Try fixing common LLM JSON issues: unescaped quotes, trailing commas
      const fixed = jsonStr
        .replace(/,\s*}/g, "}")  // trailing comma
        .replace(/,\s*]/g, "]") // trailing comma in arrays
        .replace(/[\u201c\u201d]/g, '"') // smart quotes
        .replace(/[\u2018\u2019]/g, "'"); // smart single quotes
      try {
        parsed = JSON.parse(fixed);
      } catch {
        // Last resort: extract field with regex
        const description = content.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] || "暂无描述";
        parsed = { description };
      }
    }
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate card content" },
      { status: 500 }
    );
  }
}
