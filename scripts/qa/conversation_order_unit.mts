// Danh sách chat theo HOẠT ĐỘNG gần nhất (lib/conversationOrder): người có nhiều cuộc trò chuyện (tài khoản chính thức,
// chủ tiệm) nhận tin mới trong cuộc trò chuyện CŨ → cuộc đó lên đầu (trước đây: chỉ 20 cuộc mới TẠO nhất → không thấy).
// Chạy trên BẢN CHÉP DB QA local:
//   env -u TURSO_AUTH_TOKEN TURSO_DATABASE_URL="file:<bản chép DB QA>" npx tsx scripts/qa/conversation_order_unit.mts
if (!String(process.env.TURSO_DATABASE_URL || "").startsWith("file:")) throw new Error("Chỉ chạy trên DB file local (bản chép DB QA)");
const prisma = (await import("../../lib/prisma")).default;
const { recentConversationIds } = await import("../../lib/conversationOrder");
let pass = 0, fail = 0;
const ok = (id: string, desc: string, cond: boolean, detail: unknown = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} [${id}] ${desc}${cond ? "" : "  → " + JSON.stringify(detail)}`);
};
const stamp = Date.now();
const mk = (n: string) => prisma.user.create({ data: { name: n, email: `qa.order.${n}.${stamp}@qa.test`, password: "x", role: "OWNER", market: "US", state: "CA" }, select: { id: true } });
const hub = await mk("hub");
const convIds: string[] = [];
for (let i = 0; i < 25; i++) {
  const other = await mk(`p${i}`);
  const c = await prisma.conversation.create({ data: { participants: { connect: [{ id: hub.id }, { id: other.id }] }, createdAt: new Date(stamp - (25 - i) * 60_000) }, select: { id: true } });
  await prisma.message.create({ data: { conversationId: c.id, senderId: other.id, body: `hi ${i}`, createdAt: new Date(stamp - (25 - i) * 60_000 + 1000) } });
  convIds.push(c.id);
}
const oldest = convIds[0];
const before = await recentConversationIds(hub.id, 20);
ok("O1", "Trước tin mới: cuộc trò chuyện cũ nhất KHÔNG nằm trong 20 cuộc gần nhất (đúng thứ tự hoạt động)", !before.includes(oldest) && before[0] === convIds[24], { first: before[0] });
const sender = await prisma.conversation.findUnique({ where: { id: oldest }, select: { participants: { select: { id: true } } } });
await prisma.message.create({ data: { conversationId: oldest, senderId: sender!.participants.find((p) => p.id !== hub.id)!.id, body: "tin mới trong cuộc cũ" } });
const after = await recentConversationIds(hub.id, 20);
ok("O2", "Có tin mới trong cuộc trò chuyện CŨ → lên đầu danh sách", after[0] === oldest && after.length === 20, { first: after[0] });
const empty = await prisma.conversation.create({ data: { participants: { connect: [{ id: hub.id }, { id: (await mk("new")).id }] } }, select: { id: true } });
const withEmpty = await recentConversationIds(hub.id, 20);
ok("O3", "Cuộc trò chuyện vừa tạo, chưa có tin → vẫn hiện (theo ngày tạo)", withEmpty[0] === empty.id, { first: withEmpty[0] });
console.log(`\nThứ tự danh sách chat: ${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
