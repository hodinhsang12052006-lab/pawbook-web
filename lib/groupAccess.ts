// Quyền trong NHÓM chat: chỉ thành viên nhóm (participants) mới xem / ghi lịch làm việc, mới vào cuộc họp nhóm.
// Nhóm không có link mời / nút thêm người → danh sách thành viên là ranh giới bảo mật duy nhất, kiểm ở MỌI API nhóm.
import prisma from "@/lib/prisma";

export interface GroupMember { id: string; name: string | null; avatarUrl: string | null; role: string }
export interface GroupInfo { id: string; name: string | null; members: GroupMember[] }

/** Nhóm `convId` nếu `userId` là thành viên; không phải nhóm / không phải thành viên → null (không phân biệt). */
export async function groupForMember(convId: string, userId: string): Promise<GroupInfo | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(convId)) return null;
  const c = await prisma.conversation.findFirst({
    where: { id: convId, isGroup: true, participants: { some: { id: userId } } },
    select: { id: true, name: true, participants: { select: { id: true, name: true, avatarUrl: true, role: true } } },
  });
  return c ? { id: c.id, name: c.name, members: c.participants.map((p) => ({ ...p, role: String(p.role) })) } : null;
}

export const isMissingTable = (e: unknown) => {
  const x = e as { code?: string; message?: string } | null;
  return x?.code === "P2021" || /no such table|does not exist/i.test(String(x?.message || ""));
};
