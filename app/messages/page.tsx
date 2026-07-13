import MessagesContent from "@/components/chat/MessagesContent";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const userId = session.user.id;

  // Query conversations
  const conversationsData = await prisma.conversation.findMany({
    where: {
      participants: {
        some: { id: userId },
      },
    },
    include: {
      participants: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          role: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const initialConversations = conversationsData.map((conv) => ({
    id: conv.id,
    isGroup: conv.isGroup,
    name: conv.name || null,
    createdAt: conv.createdAt.toISOString(),
    participants: conv.participants.map((p) => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl || null,
      role: p.role,
    })),
    messages: conv.messages.map((m) => ({
      id: m.id,
      body: m.body,
      type: m.type,
      senderId: m.senderId,
      conversationId: m.conversationId,
      createdAt: m.createdAt.toISOString(),
    })),
  }));

  // Query system users
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

  const initialSystemUsers = usersData.map((user) => ({
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    role: user.role,
  }));

  return (
    <MessagesContent
      initialSessionUser={session.user}
      initialConversations={initialConversations}
      initialMessages={[]} // Will be loaded dynamically per chat conversation
      initialSystemUsers={initialSystemUsers}
    />
  );
}