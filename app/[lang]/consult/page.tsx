"use client";

import React from "react";
import Navbar from "@/components/layout/Navbar";
import HandConsult from "@/components/consult/HandConsult";

// /consult — "Soi tay tư vấn" cho thợ / chủ tiệm.
export default function ConsultPage() {
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 md:pb-12">
        <HandConsult />
      </main>
    </div>
  );
}
