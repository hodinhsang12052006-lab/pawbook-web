import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Polyfill DOMMatrix for node environment compatibility with pdf-parse canvas modules
if (typeof global !== "undefined" && !(global as any).DOMMatrix) {
  (global as any).DOMMatrix = class DOMMatrix {};
}

const pdf = require("pdf-parse");

const SKILL_KEYWORDS = [
  { term: "nextjs", patterns: ["nextjs", "next.js", "next js"] },
  { term: "react", patterns: ["react", "reactjs", "react.js"] },
  { term: "typescript", patterns: ["typescript", "ts"] },
  { term: "javascript", patterns: ["javascript", "js"] },
  { term: "tailwindcss", patterns: ["tailwindcss", "tailwind"] },
  { term: "python", patterns: ["python"] },
  { term: "scraping", patterns: ["scraping", "scraper", "cào dữ liệu"] },
  { term: "playwright", patterns: ["playwright"] },
  { term: "automation", patterns: ["automation", "tự động hóa"] },
  { term: "massage", patterns: ["massage", "xoa bóp", "trị liệu"] },
  { term: "skincare", patterns: ["skincare", "chăm sóc da", "trị mụn", "tắm trắng", "triệt lông"] },
  { term: "sua-xe-may", patterns: ["sửa xe máy", "sửa xe", "thay nhớt", "cơ khí"] },
  { term: "coffee", patterns: ["coffee", "cà phê", "cafe"] },
  { term: "barista", patterns: ["barista", "pha chế"] },
  { term: "figma", patterns: ["figma"] },
  { term: "ui-ux", patterns: ["ui/ux", "ui-ux", "ux/ui", "design"] },
  { term: "devops", patterns: ["devops", "ci/cd", "ci-cd"] },
  { term: "docker", patterns: ["docker"] },
  { term: "nodejs", patterns: ["nodejs", "node.js", "node js"] },
  { term: "prisma", patterns: ["prisma"] },
  { term: "sql", patterns: ["sql", "sqlite", "postgres", "mysql"] },
  { term: "git", patterns: ["git", "github"] },
];

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để phân tích CV." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Không tìm thấy tệp tin PDF nào được tải lên." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the PDF text contents using pdf-parse
    const parsedData = await pdf(buffer);
    const pdfText = (parsedData.text || "").toLowerCase();

    // Match keywords against predefined skills dictionary
    const detectedSkills: string[] = [];
    SKILL_KEYWORDS.forEach((skill) => {
      const isMatched = skill.patterns.some((pattern) => pdfText.includes(pattern));
      if (isMatched) {
        detectedSkills.push(skill.term);
      }
    });

    return NextResponse.json({
      skills: detectedSkills.join(", "),
      textLength: pdfText.length,
    });
  } catch (err: any) {
    console.error("AI CV Parser API error:", err);
    return NextResponse.json(
      { error: "Lỗi phân tích cú pháp tệp tin PDF." },
      { status: 500 }
    );
  }
}
