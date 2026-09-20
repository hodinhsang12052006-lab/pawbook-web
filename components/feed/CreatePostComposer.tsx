"use client";

import React, { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Image as ImageIcon, X, Loader2, Sparkles } from "lucide-react";
import { useSessionUser } from "@/lib/SessionUserContext";
import { prepareFileForUpload, FileTooLargeError } from "@/lib/compressImage";
import type { FeedPost } from "./FeedPostCard";

const AVATAR_FALLBACK = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ec4899&color=ffffff&bold=true&format=png`;

const PRESS = "active:scale-[0.98] transition-transform duration-100";

const POST_TYPE_OPTIONS: { value: "GENERAL" | "SHOWCASE"; label: string }[] = [
  { value: "GENERAL", label: "💬 Chia sẻ" },
  { value: "SHOWCASE", label: "✨ Khoe tay nghề / tiệm" },
];

export default function CreatePostComposer({ onPosted }: { onPosted: (post: FeedPost) => void }) {
  const { user } = useSessionUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<"GENERAL" | "SHOWCASE">("GENERAL");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  if (!user) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const rawFile of Array.from(files).slice(0, 5 - mediaUrls.length)) {
        try {
          const file = await prepareFileForUpload(rawFile);
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (res.ok && data.url) {
            setMediaUrls((prev) => [...prev, data.url]);
          } else {
            toast.error(data.error || `Không thể tải "${rawFile.name}" lên.`);
          }
        } catch (err) {
          toast.error(err instanceof FileTooLargeError ? err.message : `Lỗi mạng khi tải "${rawFile.name}" lên.`);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeMedia = (url: string) => setMediaUrls((prev) => prev.filter((u) => u !== url));

  const handleSubmit = async () => {
    if (!content.trim() && mediaUrls.length === 0) {
      toast.error("Viết vài dòng hoặc đăng ảnh trước khi chia sẻ nhé.");
      return;
    }
    setPosting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() || "📸", postType, mediaUrls }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể đăng bài.");
        return;
      }
      onPosted(data);
      setContent("");
      setMediaUrls([]);
      setPostType("GENERAL");
      toast.success("Đã đăng bài! 🎉");
    } catch {
      toast.error("Lỗi mạng. Vui lòng thử lại.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <img
          src={user.avatarUrl || AVATAR_FALLBACK(user.name)}
          alt={user.name}
          className="h-10 w-10 rounded-full object-cover border border-slate-800 flex-shrink-0"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Khoe tác phẩm móng mới, cập nhật tình hình tiệm, hoặc bất cứ điều gì... #NailArt"
          rows={2}
          maxLength={2000}
          className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
      </div>

      {mediaUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pl-[52px]">
          {mediaUrls.map((url) => (
            <div key={url} className="relative flex-shrink-0 h-20 w-20 rounded-xl overflow-hidden border border-slate-800">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeMedia(url)}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pl-[52px] flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || mediaUrls.length >= 5}
            className={`flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white disabled:opacity-40 ${PRESS}`}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Ảnh/Video
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUpload} />

          <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
            {POST_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPostType(opt.value)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                  postType === opt.value ? "bg-pink-600 text-white" : "text-slate-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={posting || uploading}
          className={`flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-pink-600/20 disabled:opacity-50 ${PRESS}`}
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Đăng bài
        </button>
      </div>
    </div>
  );
}
