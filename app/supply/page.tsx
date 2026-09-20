"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import toast from "react-hot-toast";
import { Package, Plus, X, Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { prepareFileForUpload, FileTooLargeError } from "@/lib/compressImage";
import SupplyProductCard, { SupplyProductType } from "@/components/feed/SupplyProductCard";

const PRESS = "active:scale-[0.98] transition-transform duration-100";

// Form đăng bán — chỉ Chủ tiệm (khớp guard ở app/api/supply/route.ts:POST).
function CreateProductForm({ onCreated, onClose }: { onCreated: (p: SupplyProductType) => void; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setUploading(true);
    try {
      const file = await prepareFileForUpload(rawFile);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) setImageUrl(data.url);
      else toast.error(data.error || "Không thể tải ảnh lên.");
    } catch (err) {
      toast.error(err instanceof FileTooLargeError ? err.message : "Lỗi mạng khi tải ảnh.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !imageUrl || !price) {
      toast.error("Vui lòng nhập tên, giá và ảnh sản phẩm.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/supply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          imageUrl,
          price: Number(price),
          originalPrice: originalPrice ? Number(originalPrice) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể đăng sản phẩm.");
        return;
      }
      toast.success("Đã đăng bán sản phẩm! 📦");
      onCreated(data);
      onClose();
    } catch {
      toast.error("Lỗi mạng. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4 animate-scaleUp">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-400" /> Đăng bán sỉ vật tư
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-video rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-amber-500 hover:text-amber-400 transition-colors overflow-hidden relative"
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs font-bold">Tải ảnh sản phẩm</span>
            </>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5">Tên sản phẩm</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Set Cọ Đắp Bột Cao Cấp"
            className="w-full min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5">Mô tả (không bắt buộc)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Chất lượng, số lượng tối thiểu, cách giao hàng..."
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Giá bán ($)</label>
            <input
              type="number" min={0} step="0.01" inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="45.00"
              className="w-full min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Giá gốc (nếu giảm)</label>
            <input
              type="number" min={0} step="0.01" inputMode="decimal"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              placeholder="60.00"
              className="w-full min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || uploading}
          className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-sm font-black text-amber-950 disabled:opacity-50 ${PRESS}`}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Đăng bán ngay
        </button>
      </div>
    </div>
  );
}

export default function SupplyPage() {
  const { user } = useSessionUser();
  const [products, setProducts] = useState<SupplyProductType[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/supply")
      .then((res) => {
        if (!res.ok) throw new Error("Không thể tải kho hàng.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Đã xảy ra lỗi.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/supply?cursor=${nextCursor}`);
      if (res.ok) {
        const data = await res.json();
        setProducts((prev) => [...prev, ...data.products]);
        setNextCursor(data.nextCursor);
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: "400px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto flex-1 w-full max-w-6xl px-4 py-8 pb-24 md:pb-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Package className="h-6 w-6 text-amber-400" /> Kho Hàng Supply
            </h1>
            <p className="text-sm text-slate-400 mt-1">Hàng sỉ vật tư nail giữa các tiệm — không qua thanh toán trong app, liên hệ trực tiếp để chốt đơn.</p>
          </div>
          {user?.role === "OWNER" && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className={`flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 px-4 py-3 text-sm font-black text-amber-950 shadow-lg shadow-amber-500/20 ${PRESS}`}
            >
              <Plus className="h-4.5 w-4.5" /> Đăng bán sản phẩm
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/30 aspect-[16/10] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" /> <span>{error}</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <Package className="h-10 w-10 text-slate-700" />
            <p className="text-base font-bold text-slate-300">Chưa có sản phẩm nào trong kho hàng</p>
            <p className="text-sm text-slate-500">Chủ tiệm hãy là người đầu tiên đăng bán sỉ vật tư.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
            {products.map((p) => (
              <SupplyProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-2 w-full" />
        {loadingMore && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
          </div>
        )}
      </main>

      {showForm && (
        <CreateProductForm
          onClose={() => setShowForm(false)}
          onCreated={(p) => setProducts((prev) => [p, ...prev])}
        />
      )}
    </div>
  );
}
