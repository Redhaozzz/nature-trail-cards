import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const prompt = `你是一个儿童自然教育专家。请为以下物种生成一张适合3岁中国孩子的亲子知识卡片。

物种：${body.common_name} (${body.scientific_name})
类别：${body.iconic_taxon_name}
Wikipedia简介：${body.wikipedia_summary || "无"}
地点：${body.place_name}
月份：${body.current_month}月

请严格按以下JSON格式输出（中文），不要输出其他内容：
{
  "recognition": "怎么认出它的描述，用孩子能懂的视觉特征描述，2-3句话",
  "fun_fact": "这个物种最独特/有趣的习性，用生动有画面感的方式描述，3-4句话",
  "talk_to_kid": "家长可以直接对孩子说的一段话，自然口语，1-2句话，包含一个互动引导"
}

要求：语气温暖有趣，多用拟人化和比喻，适合3岁理解力。可以适当使用emoji。`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "No content generated" }, { status: 500 });
    }

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate card content" },
      { status: 500 }
    );
  }
}
