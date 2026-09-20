"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Newspaper } from "lucide-react";
import FeedPostCard, { FeedPost } from "./FeedPostCard";
import SupplyProductCard, { SupplyProductType } from "./SupplyProductCard";
import CreatePostComposer from "./CreatePostComposer";

interface SocialFeedProps {
  market: "US" | "AU";
  state: string;
  city: string;
}

// Chen 1 thẻ sản phẩm supply sau mỗi N bài đăng — đủ thưa để không thành
// spam quảng cáo giữa dòng nội dung xã hội, đủ dày để kho hàng thật sự có
// mặt trong tầm mắt khi lướt.
const SUPPLY_EVERY_N_POSTS = 4;

function FeedSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải bảng tin">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-slate-800" />
            <div className="space-y-2 flex-1">
              <div className="h-3.5 w-1/3 rounded bg-slate-800" />
              <div className="h-3 w-1/4 rounded bg-slate-800/70" />
            </div>
          </div>
          <div className="h-3.5 w-full rounded bg-slate-800/70" />
          <div className="h-3.5 w-2/3 rounded bg-slate-800/70" />
          <div className="h-48 w-full rounded-2xl bg-slate-800/60" />
        </div>
      ))}
    </div>
  );
}

export default function SocialFeed({ market, state, city }: SocialFeedProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [supplyProducts, setSupplyProducts] = useState<SupplyProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset & tải trang đầu mỗi khi đổi vùng US/AU/bang/thành phố.
  useEffect(() => {
    let cancelled = false;
    async function fetchFirstPage() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ market });
        if (state) params.set("state", state);
        if (city) params.set("city", city);
        const res = await fetch(`/api/posts?${params.toString()}`);
        if (!res.ok) throw new Error("Không thể tải bảng tin.");
        const data = await res.json();
        if (cancelled) return;
        setPosts(data.posts);
        setNextCursor(data.nextCursor);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Đã xảy ra lỗi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchFirstPage();
    return () => {
      cancelled = true;
    };
  }, [market, state, city]);

  // Kho hàng supply tải riêng 1 lần (không phụ thuộc vùng — hàng sỉ thường
  // giao được nhiều nơi), dùng để chen vào giữa newsfeed.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/supply")
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => {
        if (!cancelled) setSupplyProducts(data.products || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ market, cursor: nextCursor });
      if (state) params.set("state", state);
      if (city) params.set("city", city);
      const res = await fetch(`/api/posts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => [...prev, ...data.posts]);
        setNextCursor(data.nextCursor);
      }
    } catch (err) {
      console.error("Failed to load more feed posts:", err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [market, state, city, nextCursor]);

  // Cuộn vô hạn kiểu vuốt mượt 1 ngón tay — không cần bấm nút "Tải thêm".
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  const handlePosted = (post: FeedPost) => setPosts((prev) => [post, ...prev]);

  // Trộn bài đăng + thẻ sản phẩm thành 1 danh sách render duy nhất.
  const feedItems = useMemo(() => {
    if (supplyProducts.length === 0) return posts.map((p) => ({ type: "post" as const, post: p }));
    const items: Array<{ type: "post"; post: FeedPost } | { type: "supply"; product: SupplyProductType }> = [];
    let supplyIdx = 0;
    posts.forEach((post, idx) => {
      items.push({ type: "post", post });
      if ((idx + 1) % SUPPLY_EVERY_N_POSTS === 0) {
        items.push({ type: "supply", product: supplyProducts[supplyIdx % supplyProducts.length] });
        supplyIdx += 1;
      }
    });
    return items;
  }, [posts, supplyProducts]);

  return (
    <div className="space-y-4">
      <CreatePostComposer onPosted={handlePosted} />

      {loading ? (
        <FeedSkeleton />
      ) : error ? (
        <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : feedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <Newspaper className="h-10 w-10 text-slate-700" />
          <p className="text-base font-bold text-slate-300">Chưa có bài đăng nào ở khu vực này</p>
          <p className="text-sm text-slate-500">Hãy là người đầu tiên chia sẻ!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedItems.map((item, idx) =>
            item.type === "post" ? (
              <FeedPostCard key={`post-${item.post.id}`} post={item.post} />
            ) : (
              <SupplyProductCard key={`supply-slot-${idx}`} product={item.product} />
            )
          )}
        </div>
      )}

      <div ref={sentinelRef} className="h-2 w-full" />
      {loadingMore && (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-5 w-5 text-pink-500 animate-spin" />
        </div>
      )}
    </div>
  );
}
