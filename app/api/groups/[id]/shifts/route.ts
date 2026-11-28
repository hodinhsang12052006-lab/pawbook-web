import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { groupForMember, isMissingTable } from "@/lib/groupAccess";
import { sendPush } from "@/lib/push";

// LỊCH LÀM VIỆC của 1 nhóm chat (chỉ thành viên nhóm):
//   GET    /api/groups/:id/shifts?from=YYYY-MM-DD&days=7   → ca làm trong khoảng ngày
//   POST   /api/groups/:id/shifts { date, start, end, userId, note }   → thêm ca (người làm phải là thành viên nhóm)
//   DELETE /api/groups/:id/shifts?shiftId=…   → xoá ca (người tạo ca, người làm ca, hoặc ADMIN)
// Bảng chưa tạo (chưa chạy prisma/sql/2026-11-29_group_shifts.sql) → GET trả rỗng + pending, ghi trả 503.
type Ctx = { params: Promise<{ id: string }> };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DAYS = 31;
const MAX_SHIFTS_PER_DAY = 60;

async function me() {
  const s = await getServerSession(authOptions).catch(() => null);
  return (s?.user ?? null) as { id?: string; role?: string; name?: string | null } | null;
}
const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export async function GET(req: Request, { params }: Ctx) {
  const u = await me();
  if (!u?.id) return NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 });
  const { id } = await params;
  const g = await groupForMember(id, u.id);
  if (!g) return NextResponse.json({ error: "Không tìm thấy nhóm.", errorEn: "Group not found." }, { status: 404 });
  const sp = new URL(req.url).searchParams;
  const from = DATE_RE.test(sp.get("from") || "") ? sp.get("from")! : new Date().toISOString().slice(0, 10);
  const days = Math.min(MAX_DAYS, Math.max(1, Number(sp.get("days")) || 7));
  const to = addDays(from, days - 1);
  try {
    const shifts = await prisma.groupShift.findMany({ where: { conversationId: id, date: { gte: from, lte: to } }, orderBy: [{ date: "asc" }, { start: "asc" }], take: 500 });
    return NextResponse.json({ from, to, members: g.members, shifts: shifts.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), canDelete: s.createdById === u.id || s.userId === u.id || u.role === "ADMIN" })) });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ from, to, members: g.members, shifts: [], pending: true });
    console.error("GET shifts error:", e);
    return NextResponse.json({ error: "Không tải được lịch.", errorEn: "Couldn't load the schedule." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const u = await me();
  if (!u?.id) return NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 });
  const { id } = await params;
  const g = await groupForMember(id, u.id);
  if (!g) return NextResponse.json({ error: "Không tìm thấy nhóm.", errorEn: "Group not found." }, { status: 404 });
  const b = (await req.json().catch(() => null)) as { date?: string; start?: string; end?: string; userId?: string; note?: string } | null;
  const date = String(b?.date || "");
  const start = String(b?.start || "");
  const end = String(b?.end || "");
  const assignee = g.members.find((m) => m.id === b?.userId);
  if (!DATE_RE.test(date) || !TIME_RE.test(start) || !TIME_RE.test(end)) return NextResponse.json({ error: "Ngày / giờ không hợp lệ.", errorEn: "Invalid date or time." }, { status: 400 });
  if (end <= start) return NextResponse.json({ error: "Giờ kết thúc phải sau giờ bắt đầu.", errorEn: "The end time must be after the start time." }, { status: 400 });
  if (!assignee) return NextResponse.json({ error: "Người làm ca phải là thành viên nhóm.", errorEn: "The person must be a member of this group." }, { status: 400 });
  const note = String(b?.note || "").replace(/[<>]/g, "").trim().slice(0, 200);
  try {
    if ((await prisma.groupShift.count({ where: { conversationId: id, date } })) >= MAX_SHIFTS_PER_DAY) {
      return NextResponse.json({ error: "Ngày này đã có quá nhiều ca.", errorEn: "This day already has too many shifts." }, { status: 429 });
    }
    const s = await prisma.groupShift.create({ data: { conversationId: id, userId: assignee.id, date, start, end, note, createdById: u.id } });
    // Báo người được xếp ca (thông báo đẩy) — sau khi trả lời
    if (assignee.id !== u.id) {
      try {
        after(() =>
          sendPush(assignee.id, {
            title: `📅 ${g.name || "Nhóm"}: ca làm mới`,
            body: `${u.name || "Quản lý"} xếp bạn ca ${start}–${end} ngày ${date.split("-").reverse().join("/")}${note ? ` · ${note}` : ""}`,
            url: `/messages?c=${id}`,
            tag: `pn-shift-${s.id}`,
          }).then(() => undefined).catch(() => undefined),
        );
      } catch {}
    }
    return NextResponse.json({ ...s, createdAt: s.createdAt.toISOString(), canDelete: true }, { status: 201 });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: "Lịch làm việc đang được bật, thử lại sau ít phút.", errorEn: "The schedule is being switched on. Try again in a few minutes." }, { status: 503 });
    console.error("POST shift error:", e);
    return NextResponse.json({ error: "Không thêm được ca.", errorEn: "Couldn't add the shift." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const u = await me();
  if (!u?.id) return NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 });
  const { id } = await params;
  const g = await groupForMember(id, u.id);
  if (!g) return NextResponse.json({ error: "Không tìm thấy nhóm.", errorEn: "Group not found." }, { status: 404 });
  const shiftId = new URL(req.url).searchParams.get("shiftId") || "";
  try {
    const s = await prisma.groupShift.findFirst({ where: { id: shiftId, conversationId: id } });
    if (!s) return NextResponse.json({ error: "Không tìm thấy ca.", errorEn: "Shift not found." }, { status: 404 });
    if (s.createdById !== u.id && s.userId !== u.id && u.role !== "ADMIN") return NextResponse.json({ error: "Bạn không xoá được ca này.", errorEn: "You can't delete this shift." }, { status: 403 });
    await prisma.groupShift.delete({ where: { id: s.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isMissingTable(e)) return NextResponse.json({ error: "Lịch làm việc chưa bật.", errorEn: "The schedule isn't on yet." }, { status: 503 });
    console.error("DELETE shift error:", e);
    return NextResponse.json({ error: "Không xoá được ca.", errorEn: "Couldn't delete the shift." }, { status: 500 });
  }
}
