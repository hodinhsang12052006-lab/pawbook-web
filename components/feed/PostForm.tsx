"use client";

import React, { useState, useRef } from "react";
import { Image as ImageIcon, Video as VideoIcon, FileText, Send, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface PostFormProps {
  onAddPost?: () => void;
}

export default function PostForm({ onAddPost }: PostFormProps) {
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  // Blog Mode states
  const [isBlogMode, setIsBlogMode] = useState(false);
  const [blogTitle, setBlogTitle] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (isBlogMode && !blogTitle.trim()) {
      toast.error("Vui lòng nhập tiêu đề Blog!");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Đang đăng bài viết...");

    try {
      const finalContent = isBlogMode
        ? `📝 BLOG: ${blogTitle.toUpperCase()}\n\n${content}`
        : content;
        
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: finalContent,
          mediaType: mediaType || undefined,
          mediaUrl: mediaUrl.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Đăng bài thất bại. Vui lòng đăng nhập.", { id: toastId });
      } else {
        toast.success("Đăng bài viết thành công!", { id: toastId });
        // Reset states
        setContent("");
        setBlogTitle("");
        setMediaUrl("");
        setMediaType(null);
        setIsBlogMode(false);
        
        if (onAddPost) {
          onAddPost();
        }
      }
    } catch (err) {
      toast.error("Đã xảy ra lỗi kết nối mạng.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    const toastId = toast.loading("Đang tải ảnh lên Cloudinary...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Tải ảnh thất bại.");
      }

      const data = await res.json();
      setMediaUrl(data.secure_url);
      setMediaType("image");
      toast.success("Đã tải ảnh lên thành công!", { id: toastId });
    } catch (err: any) {
      toast.error("Không thể tải ảnh lên. Vui lòng thử lại.", { id: toastId });
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleMediaToggle = (type: "image" | "video") => {
    if (type === "image") {
      handleImageClick();
    } else {
      // Toggle custom URL input for videos or manual links
      if (mediaType === "video") {
        setMediaType(null);
        setMediaUrl("");
      } else {
        setMediaType("video");
        setMediaUrl("");
      }
    }
  };

  const clearMedia = () => {
    setMediaUrl("");
    setMediaType(null);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 backdrop-blur-md transition-all duration-300">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-full border border-slate-800 flex-shrink-0">
              <img
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80"
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-200">Đăng bài viết mới</span>
              {isBlogMode && (
                <span className="ml-2 inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-3xs font-semibold text-blue-400 border border-blue-500/20">
                  Chế độ Blog
                </span>
              )}
            </div>
          </div>

          {isBlogMode && (
            <button
              type="button"
              onClick={() => setIsBlogMode(false)}
              className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-2xs"
            >
              <X className="h-3.5 w-3.5" /> Hủy Blog
            </button>
          )}
        </div>

        {/* Blog Title Input */}
        {isBlogMode && (
          <div className="space-y-1">
            <input
              type="text"
              placeholder="Nhập tiêu đề bài viết blog..."
              value={blogTitle}
              onChange={(e) => setBlogTitle(e.target.value)}
              disabled={loading}
              className="w-full bg-transparent border-b border-slate-800 py-1.5 text-base font-bold text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
        )}

        {/* Text Area */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={loading}
              placeholder={
                isBlogMode
                  ? "Viết nội dung chi tiết bài blog của bạn tại đây... Hãy chia sẻ thật sâu sắc nhé!"
                  : "Hôm nay bạn muốn chia sẻ kiến thức gì hay Fomo điều gì với cộng đồng?"
              }
              rows={isBlogMode ? 6 : 3}
              className="w-full resize-none border-0 bg-transparent p-0 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-0 focus:ring-offset-0"
            />
          </div>
        </div>

        {/* Image/Video Uploading/Preview state */}
        {uploadingMedia && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            <span className="text-3xs text-slate-500">Đang truyền tải file hình ảnh...</span>
          </div>
        )}

        {/* Media Preview or manual input */}
        {mediaUrl && !uploadingMedia && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2 relative">
            <button
              type="button"
              onClick={clearMedia}
              className="absolute right-2 top-2 p-1 bg-slate-950/80 rounded-full text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            
            {mediaType === "image" ? (
              <div className="mt-1 overflow-hidden rounded-lg max-h-48 border border-slate-800">
                <img src={mediaUrl} alt="Upload preview" className="w-full object-cover max-h-48" />
              </div>
            ) : (
              <div className="space-y-1">
                <span className="block text-2xs font-semibold text-slate-400">
                  URL Video đang đính kèm:
                </span>
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-2xs text-slate-350 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Manual URL box for video (if selected and no mediaUrl yet) */}
        {mediaType === "video" && !mediaUrl && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2 relative">
            <button
              type="button"
              onClick={clearMedia}
              className="absolute right-2 top-2 p-1 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="block text-2xs font-semibold text-slate-400">
              Nhập link URL video:
            </span>
            <input
              type="text"
              placeholder="https://example.com/video.mp4"
              onChange={(e) => setMediaUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-between border-t border-slate-850 pt-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleMediaToggle("image")}
              disabled={loading || uploadingMedia}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                mediaType === "image"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <ImageIcon className="h-4.5 w-4.5 text-emerald-500" />
              <span>Ảnh</span>
            </button>

            <button
              type="button"
              onClick={() => handleMediaToggle("video")}
              disabled={loading || uploadingMedia}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                mediaType === "video"
                  ? "bg-rose-500/10 text-rose-400"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <VideoIcon className="h-4.5 w-4.5 text-rose-500" />
              <span>Video</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBlogMode(!isBlogMode)}
              disabled={loading || uploadingMedia}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                isBlogMode
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <FileText className="h-4.5 w-4.5 text-blue-500" />
              <span>Viết Blog</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || uploadingMedia || !content.trim() || (isBlogMode && !blogTitle.trim())}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang đăng...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>{isBlogMode ? "Đăng Blog" : "Đăng bài"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
