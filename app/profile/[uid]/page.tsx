import React from "react";
import ProfilePage from "../page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ uid: string }>;
}

export default async function DynamicProfilePage({ params }: PageProps) {
  return <ProfilePage params={params} />;
}
