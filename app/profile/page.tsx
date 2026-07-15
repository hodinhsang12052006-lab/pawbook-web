import ProfileContent from "@/components/profile/ProfileContent";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params?: Promise<{ uid: string }> }) {
  const resolvedParams = params ? await params : null;
  const resolvedUid = resolvedParams?.uid || null;

  const session = await getServerSession(authOptions);
  const targetId = resolvedUid || session?.user?.id;

  if (!targetId) {
    redirect("/auth/login");
  }

  const profileData = await prisma.user.findUnique({
    where: { id: targetId },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!profileData) {
    redirect("/");
  }

  const initialProfile = {
    id: profileData.id,
    name: profileData.name,
    email: profileData.email,
    role: profileData.role,
    avatarUrl: profileData.avatarUrl || null,
    bio: profileData.bio || null,
    phone: profileData.phone || null,
    address: profileData.address || null,
    cover_image: profileData.cover_image || null,
    cv_url: profileData.cv_url || null,
    skills: profileData.skills || null,
    reputation: profileData.reputation || 0,
    trustScore: profileData.trustScore || 5.0,
    isVerified: profileData.isVerified || false,
    pawCoin: profileData.pawCoin || 0,
    jobs: profileData.jobs.map((j) => ({
      id: j.id,
      title: j.title,
      companyName: j.companyName,
      salary: j.salary,
      niche: j.niche,
      createdAt: j.createdAt.toISOString(),
      is_premium: j.is_premium,
    })),
  };

  const postsData = await prisma.post.findMany({
    where: { authorId: targetId },
    include: {
      author: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const initialPosts = postsData.map((post) => ({
    id: post.id,
    content: post.content,
    mediaUrl: post.mediaUrl || null,
    mediaType: post.mediaType || null,
    createdAt:
      new Date(post.createdAt).toLocaleDateString("vi-VN") +
      " " +
      new Date(post.createdAt).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    author: {
      id: post.author.id,
      name: post.author.name,
      avatarUrl: post.author.avatarUrl || null,
      role: post.author.role,
      bio: post.author.bio || "",
    },
    likes: Math.floor(Math.random() * 20) + 5,
    commentsCount: 0,
    hasLiked: false,
  }));

  let initialWalletHistory: any[] = [];
  let initialBookings = { received: [], sent: [] };

  if (session?.user?.id === targetId) {
    const walletData = await prisma.transaction.findMany({
      where: { userId: targetId },
      orderBy: { createdAt: "desc" },
    });

    initialWalletHistory = walletData.map((tx) => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      createdAt: tx.createdAt.toISOString(),
    }));

    const received = await prisma.booking.findMany({
      where: { receiverId: targetId },
      include: { sender: true, job: true, service: true },
      orderBy: { createdAt: "desc" },
    });

    const sent = await prisma.booking.findMany({
      where: { senderId: targetId },
      include: { receiver: true, job: true, service: true },
      orderBy: { createdAt: "desc" },
    });

    initialBookings = {
      received: received.map((r: any) => ({
        id: r.id,
        status: r.status,
        message: r.message || null,
        createdAt: r.createdAt.toISOString(),
        sender: {
          id: r.sender.id,
          name: r.sender.name,
          avatarUrl: r.sender.avatarUrl || null,
          role: r.sender.role,
          phone: r.sender.phone || "",
        },
        job: r.job ? { title: r.job.title } : null,
        service: r.service ? { name: r.service.name } : null,
      })) as any,
      sent: sent.map((s: any) => ({
        id: s.id,
        status: s.status,
        message: s.message || null,
        createdAt: s.createdAt.toISOString(),
        receiver: {
          id: s.receiver.id,
          name: s.receiver.name,
          avatarUrl: s.receiver.avatarUrl || null,
          role: s.receiver.role,
          phone: s.receiver.phone || "",
        },
        job: s.job ? { title: s.job.title } : null,
        service: s.service ? { name: s.service.name } : null,
      })) as any,
    };
  }

  return (
    <ProfileContent
      resolvedUid={resolvedUid}
      initialSessionUser={session?.user || null}
      initialProfile={initialProfile}
      initialPosts={initialPosts}
      initialWalletHistory={initialWalletHistory}
      initialBookings={initialBookings}
    />
  );
}
