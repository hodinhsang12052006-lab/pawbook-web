"use client";

import React from "react";
import ProfilePage from "../page";

interface PageProps {
  params: Promise<{ uid: string }>;
}

export default function DynamicProfilePage({ params }: PageProps) {
  return <ProfilePage params={params} />;
}
