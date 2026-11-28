import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { groupForMember } from "@/lib/groupAccess";
import { getPusherServer } from "@/lib/pusherServer";
import { chatChannelName } from "@/lib/pusherChannel";
import { sendPush } from "@/lib/push";

// HỌP NHÓM (video nhiều người, WebRTC mesh — mỗi cặp 1 kết nối, tối đa MAX_IN_ROOM người) trong 1 nhóm chat.
// Máy chủ chỉ chuyển tín hiệu (SDP / ICE) qua kênh riêng của từng người (private-chat-<id>), không đụng media.
//   GET  /api/group-calls?c=<convId>                         → ai đang trong cuộc họp
//   POST /api/group-calls { c, action: "join" | "heartbeat" | "leave" }
//   POST /api/group-calls { c, action: "signal", to, data }  → chuyển SDP / ICE tới 1 người trong cuộc họp
// Chỉ thành viên nhóm; người nhận tín hiệu phải đang trong cuộc họp. Trạng thái phòng: AppSetting gcall:<convId>.
const MAX_IN_ROOM = 8;
const STALE_MS = 45_000; // không heartbeat 45 s → coi như đã rời (tab đóng / mất mạng)
const key = (c: string) => `gcall:${c}`;

type Room = Record<string, number>; // userId → lần cuối còn trong phòng (ms)

async function readRoom(c: string): Promise<Room> {
  try {
    const raw = (await prisma.appSetting.findUnique({ where: { key: key(c) } }))?.value;
    const r = JSON.parse(raw || "{}") as Room;
    const now = Date.now();
    return Object.fromEntries(Object.entries(r).filter(([, t]) => typeof t === "number" && now - t < STALE_MS));
  } catch {
    return {};
  }
}
async function writeRoom(c: string, r: Room) {
  const value = JSON.stringify(r);
  await prisma.appSetting.upsert({ where: { key: key(c) }, update: { value }, create: { key: key(c), value } });
}

async function me() {
  const s = await getServerSession(authOptions).catch(() => null);
  return (s?.user ?? null) as { id?: string; name?: string | null } | null;
}

async function broadcast(userIds: string[], event: string, data: object) {
  const p = getPusherServer();
  if (!p || !userIds.length) return;
  const batch = userIds.map((id) => ({ channel: chatChannelName(id), name: event, data }));
  for (let i = 0; i < batch.length; i += 10) await p.triggerBatch(batch.slice(i, i + 10)).catch((e) => console.error("group-call broadcast:", e));
}

export async function GET(req: Request) {
  const u = await me();
  if (!u?.id) return NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 });
  const c = new URL(req.url).searchParams.get("c") || "";
  const g = await groupForMember(c, u.id);
  if (!g) return NextResponse.json({ error: "Không tìm thấy nhóm.", errorEn: "Group not found." }, { status: 404 });
  const room = await readRoom(c);
  return NextResponse.json({ members: Object.keys(room), max: MAX_IN_ROOM }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const u = await me();
  if (!u?.id) return NextResponse.json({ error: "Vui lòng đăng nhập.", errorEn: "Please log in." }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { c?: string; action?: string; to?: string; data?: unknown } | null;
  const c = String(b?.c || "");
  const g = await groupForMember(c, u.id);
  if (!g) return NextResponse.json({ error: "Không tìm thấy nhóm.", errorEn: "Group not found." }, { status: 404 });
  const others = g.members.map((m) => m.id).filter((id) => id !== u.id);
  const room = await readRoom(c);

  if (b?.action === "join" || b?.action === "heartbeat") {
    const fresh = !room[u.id];
    if (fresh && Object.keys(room).length >= MAX_IN_ROOM) {
      return NextResponse.json({ error: `Cuộc họp đã đủ ${MAX_IN_ROOM} người.`, errorEn: `The meeting is full (${MAX_IN_ROOM} people).`, code: "ROOM_FULL" }, { status: 429 });
    }
    const starting = Object.keys(room).length === 0;
    room[u.id] = Date.now();
    await writeRoom(c, room);
    if (b.action === "join") {
      // Mọi thành viên khác: người trong phòng tạo kết nối mới, người ngoài thấy "Đang họp — Tham gia"
      await broadcast(others, "gc-join", { c, userId: u.id, name: u.name || "", count: Object.keys(room).length });
      if (starting) {
        try {
          after(() =>
            sendPush(others, { title: `📹 ${g.name || "Nhóm"}: đang họp`, body: `${u.name || "Một thành viên"} vừa bắt đầu cuộc họp — bấm để tham gia`, url: `/messages?c=${c}`, tag: `pn-gcall-${c}` })
              .then(() => undefined).catch(() => undefined),
          );
        } catch {}
      }
    }
    return NextResponse.json({ members: Object.keys(room).filter((id) => id !== u.id), max: MAX_IN_ROOM });
  }

  if (b?.action === "leave") {
    if (room[u.id]) {
      delete room[u.id];
      await writeRoom(c, room);
    }
    await broadcast(others, "gc-leave", { c, userId: u.id, count: Object.keys(room).length });
    return NextResponse.json({ ok: true });
  }

  if (b?.action === "signal") {
    const to = String(b.to || "");
    if (!room[u.id] || !room[to] || !others.includes(to)) return NextResponse.json({ error: "Người nhận không trong cuộc họp.", errorEn: "That person isn't in the meeting." }, { status: 409 });
    const data = b.data;
    if (JSON.stringify(data ?? null).length > 9000) return NextResponse.json({ error: "Tín hiệu quá lớn.", errorEn: "Signal too large." }, { status: 413 });
    await broadcast([to], "gc-signal", { c, from: u.id, data });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Thao tác không hợp lệ.", errorEn: "Invalid action." }, { status: 400 });
}
