import MessagesContent from "@/components/chat/MessagesContent";
import Navbar from "@/components/layout/Navbar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getConversationMeta } from "@/lib/conversationReads";
import { isBubbleRequest } from "@/lib/bubbleMode";

export const dynamic = "force-dynamic";

type ConvMeta = Awaited<ReturnType<typeof getConversationMeta>>;

function mapConversation(conv: any, meta: ConvMeta) {
  return {
    id: conv.id,
    isGroup: conv.isGroup,
    name: conv.name || null,
    createdAt: conv.createdAt.toISOString(),
    participants: conv.participants.map((p: any) => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl || null,
      role: p.role,
      lastActiveAt: meta.lastActiveAt(p.id),
    })),
    ...meta.conv(conv.id),
    messages: conv.messages.map((m: any) => ({
      id: m.id,
      body: m.body,
      type: m.type,
      senderId: m.senderId,
      conversationId: m.conversationId,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

function mapUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    role: user.role,
  };
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession(authOptions);
  const sp = await searchParams;
  // Bong bóng chat Android (lib/bubbleMode.ts): chỉ khung chat của cuộc trò chuyện ?c=, không Navbar / danh sách.
  const bubble = isBubbleRequest((await headers()).get("user-agent"), sp.bubble);
  // ?c=<id> (bấm thông báo / bong bóng): cuộc trò chuyện đó phải có trong danh sách kể cả khi nằm ngoài 50 cái mới tạo nhất.
  const wantConvId = typeof sp.c === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(sp.c) ? sp.c : null;

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const userId = session.user.id;

  // Cả hai query dưới đây từng chạy trực tiếp, không try/catch — nếu Turso
  // timeout hoặc trả lỗi thoáng qua, Server Component ném exception thẳng ra
  // và Next.js hiện màn hình đỏ "Server Components render" cho toàn bộ
  // trang thay vì chỉ riêng phần tin nhắn. Fallback về mảng rỗng để trang
  // vẫn tải được (khung chat trống) thay vì crash toàn bộ.
  let initialConversations: ReturnType<typeof mapConversation>[] = [];
  let initialSystemUsers: ReturnType<typeof mapUser>[] = [];

  try {
    const include = {
      participants: { select: { id: true, name: true, avatarUrl: true, role: true } },
      messages: { orderBy: { createdAt: "desc" as const }, take: 1 },
    };
    const conversationsData = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: userId },
        },
      },
      include,
      orderBy: { createdAt: "desc" },
      // Trước đây không giới hạn — người dùng nhiều hội thoại phải tải hết.
      take: 50,
    });
    if (wantConvId && !conversationsData.some((c) => c.id === wantConvId)) {
      const wanted = await prisma.conversation.findFirst({ where: { id: wantConvId, participants: { some: { id: userId } } }, include });
      if (wanted) conversationsData.unshift(wanted);
    }

    const meta = await getConversationMeta(userId, conversationsData);
    initialConversations = conversationsData.map((c) => mapConversation(c, meta));
  } catch (err) {
    console.error("MessagesPage: failed to load conversations:", err);
  }

  try {
    const usersData = await prisma.user.findMany({
      where: {
        id: { not: userId },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        role: true,
      },
      take: 30, // Limit to initial list to speed up loading
    });

    initialSystemUsers = usersData.map(mapUser);
  } catch (err) {
    console.error("MessagesPage: failed to load system users:", err);
  }

  return (
    <div className="flex flex-col h-[100dvh] text-slate-100 select-none overflow-hidden">
      {/* Điện thoại: đang mở 1 cuộc trò chuyện (html[data-chat-open]) → ẩn thanh chung, chat toàn màn hình như app */}
      {!bubble && (
        <div className="flex-none max-md:[html[data-chat-open]_&]:hidden">
          <Navbar />
        </div>
      )}
      {/* Cùng khung max-w-7xl với Navbar — trước đây khung chat tràn sát 2 mép
          màn hình trong khi logo/nút phía trên nằm giữa, nhìn lệch hẳn. Desktop:
          khung bo góc nổi trên nền; mobile: full màn hình như app nhắn tin. */}
      <main className={bubble ? "flex w-full flex-1 min-h-0" : "mx-auto flex w-full max-w-7xl flex-1 min-h-0 md:px-6 md:py-5 lg:px-8"}>
        <div className={bubble ? "flex w-full min-h-0 overflow-hidden" : "flex w-full min-h-0 overflow-hidden md:rounded-2xl md:border md:border-white/10 md:bg-slate-950/40 md:shadow-2xl md:shadow-black/50"}>
          <MessagesContent
            initialSessionUser={session.user}
            initialConversations={initialConversations}
            initialMessages={[]} // Will be loaded dynamically per chat conversation
            initialSystemUsers={initialSystemUsers}
            bubble={bubble}
          />
        </div>
      </main>
    </div>
  );
}