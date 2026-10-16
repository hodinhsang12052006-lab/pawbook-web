"use client";

import React from "react";
import Navbar from "@/components/layout/Navbar";
import BookingInbox from "@/components/booking/BookingInbox";

// /bookings — lịch hẹn khách gửi từ menu của thợ / tiệm.
export default function BookingsPage() {
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-6 md:pb-12">
        <BookingInbox />
      </main>
    </div>
  );
}
