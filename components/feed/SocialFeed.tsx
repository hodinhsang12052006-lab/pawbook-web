"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Newspaper, Sparkles } from "lucide-react";
import FeedPostCard, { FeedPost } from "./FeedPostCard";
import SupplyProductCard, { SupplyProductType } from "./SupplyProductCard";
import CreatePostComposer from "./CreatePostComposer";
import { useSessionUser } from "@/lib/SessionUserContext";
import { TOTAL_DEMAND_COUNT } from "@/lib/nailRadarData";
import { useStudio, ThemeCard, TipCard, RecapCard } from "./StudioCards";
import PulseCard from "./PulseCard";
import RadarPostCard, { type RadarPost } from "./RadarPostCard";
import { tr } from "@/lib/i18n/tr";
import { useTr } from "@/lib/i18n/useTr";
import { DesignsStrip } from "@/components/designs/DesignViews";

// Nội dung PawNail Studio chen giữa bảng tin (mỗi loại 1 lần, đủ thưa).
const TIP_AFTER_POST = 3;
const RECAP_AFTER_POST = 8;
// "Nhịp đau tuần" ngay sau bài đầu tiên; bài radar đã duyệt chen thưa.
const PULSE_AFTER_POST = 1;
const RADAR_AFTER_POSTS = [5, 11, 17];

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
  useTr(); // render lại khi đổi VI/EN
  return (
    <div className="space-y-4" aria-busy="true" aria-label={tr("Đang tải bảng tin", "Loading feed")}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-4 space-y-3 animate-pulse">
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
  useTr(); // render lại khi đổi VI/EN
  const { user } = useSessionUser();
  const isTech = user?.role === "TECHNICIAN";
  const studio = useStudio(market, user?.role);
  const [radarPosts, setRadarPosts] = useState<RadarPost[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/radar?market=${market}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setRadarPosts(Array.isArray(d?.posts) ? d.posts : []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [market]);
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
        if (!res.ok) throw new Error(tr("Không thể tải bảng tin.", "Couldn't load the feed."));
        const data = await res.json();
        if (cancelled) return;
        setPosts(data.posts);
        setNextCursor(data.nextCursor);
      } catch (err: any) {
        if (!cancelled) setError(err.message || tr("Đã xảy ra lỗi.", "Something went wrong."));
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

  // "Tham gia #thử thách" → mở ô soạn bài với hashtag điền sẵn.
  const joinChallenge = (hashtag: string) => {
    try {
      sessionStorage.setItem("pn_compose_tag", hashtag);
    } catch {}
    window.dispatchEvent(new CustomEvent("compose-post", { detail: { hashtag } }));
  };
  const suggestedTags = Array.from(new Set([studio?.theme?.hashtag, ...(studio?.trendingTags ?? [])].filter(Boolean) as string[])).slice(0, 5);

  // Trộn bài đăng + thẻ sản phẩm thành 1 danh sách render duy nhất.
  const feedItems = useMemo(() => {
    const items: Array<
      { type: "post"; post: FeedPost } | { type: "supply"; product: SupplyProductType } | { type: "tip" } | { type: "recap" } | { type: "pulse" } | { type: "radar"; post: RadarPost }
    > = [];
    let supplyIdx = 0;
    posts.forEach((post, idx) => {
      items.push({ type: "post", post });
      if (idx + 1 === TIP_AFTER_POST && studio?.tip) items.push({ type: "tip" });
      if (idx + 1 === RECAP_AFTER_POST && studio?.recap) items.push({ type: "recap" });
      if (idx + 1 === PULSE_AFTER_POST && user) items.push({ type: "pulse" });
      const r = RADAR_AFTER_POSTS.indexOf(idx + 1);
      if (r >= 0 && radarPosts[r]) items.push({ type: "radar", post: radarPosts[r] });
      if (supplyProducts.length > 0 && (idx + 1) % SUPPLY_EVERY_N_POSTS === 0) {
        items.push({ type: "supply", product: supplyProducts[supplyIdx % supplyProducts.length] });
        supplyIdx += 1;
      }
    });
    return items;
  }, [posts, supplyProducts, studio, radarPosts, user]);

  return (
    <div className="space-y-4">
      {/* Chỉ THỢ mới thấy — số liệu thật (xem lib/nailRadarData.ts) cho thấy
          tỉ lệ "chủ tìm thợ" áp đảo "thợ tìm việc" trên thị trường, nên đây
          chính là lúc đúng nhất để nhắc thợ đăng bài — họ đang là bên được
          săn đón, chỉ cần xuất hiện là dễ được chủ để ý ngay. */}
      {studio?.theme && <ThemeCard studio={studio} isOwner={user?.role === "OWNER"} onJoin={joinChallenge} />}
      {isTech && !studio?.theme && (
        <div className="flex items-center gap-3 rounded-2xl border border-pink-500/25 bg-gradient-to-r from-pink-950/30 via-slate-900/30 to-slate-900/30 px-4 py-3">
          <Sparkles className="h-5 w-5 text-pink-400 flex-shrink-0" />
          <p className="text-xs sm:text-sm text-slate-200">
            <span className="font-black text-pink-400">{TOTAL_DEMAND_COUNT[market]}{tr("+ tin chủ tìm thợ", "+ salon hiring posts")}</span>{tr(" tại ", " in ")}{market === "US" ? tr("Mỹ", "the US") : tr("Úc", "Australia")}{tr(" trong 1 đợt khảo sát nhóm nail (9/2026) — đăng ảnh tay nghề để chủ tiệm dễ tìm thấy bạn hơn.", " in one survey of nail groups (Sep 2026) — post your work so salons can find you.")}
          </p>
        </div>
      )}
      <CreatePostComposer onPosted={handlePosted} suggestedTags={suggestedTags} />

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
          <p className="text-base font-bold text-slate-300">{tr("Chưa có bài đăng nào ở khu vực này", "No posts in this area yet")}</p>
          <p className="text-sm text-slate-500">{tr("Hãy là người đầu tiên chia sẻ!", "Be the first to share!")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <DesignsStrip />
          {feedItems.map((item, idx) =>
            item.type === "post" ? (
              <FeedPostCard
                key={`post-${item.post.id}`}
                post={item.post}
                onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              />
            ) : item.type === "supply" ? (
              <SupplyProductCard key={`supply-slot-${idx}`} product={item.product} />
            ) : item.type === "tip" ? (
              // Màn hình rộng (xl) đã có "Mẹo hôm nay" ở cột phải — tránh 2 mẹo khác nhau cùng lúc.
              <div key="studio-tip" className="xl:hidden"><TipCard tip={studio!.tip} /></div>
            ) : item.type === "pulse" ? (
              <PulseCard key="pulse" />
            ) : item.type === "radar" ? (
              <RadarPostCard key={`radar-${item.post.id}`} post={item.post} />
            ) : (
              <RecapCard key="studio-recap" recap={studio!.recap!} market={market} />
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
