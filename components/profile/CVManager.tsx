"use client";

import React, { useState, useEffect } from "react";
import { UploadCloud, FileText, Trash2, Eye, ShieldCheck, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function CVManager() {
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Fetch existing CV URL on mount
  useEffect(() => {
    async function loadCv() {
      try {
        setLoading(true);
        const res = await fetch("/api/user/cv");
        if (res.ok) {
          const data = await res.json();
          setCvUrl(data.cvUrl);
        }
      } catch (err) {
        console.error("Failed to load CV:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCv();
  }, []);

  const uploadFile = async (file: File) => {
    const toastId = toast.loading("Đang tải file lên Cloudinary...");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // 1. Upload to Cloudinary
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Không thể tải file lên Cloudinary.");
      }

      const uploadData = await uploadRes.json();
      const secureUrl = uploadData.secure_url;

      // 2. Update user profile cvUrl in database
      const updateRes = await fetch("/api/user/cv", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cvUrl: secureUrl }),
      });

      if (!updateRes.ok) {
        throw new Error("Không thể cập nhật hồ sơ người dùng.");
      }

      setCvUrl(secureUrl);
      toast.success("Tải lên CV thành công!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Tải lên thất bại. Vui lòng thử lại.", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa CV này?")) return;

    const toastId = toast.loading("Đang gỡ bỏ hồ sơ CV...");
    try {
      const res = await fetch("/api/user/cv", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cvUrl: "" }), // Clear CV link in DB
      });

      if (!res.ok) {
        throw new Error("Không thể gỡ bỏ CV trên database.");
      }

      setCvUrl(null);
      toast.success("Đã xóa CV thành công!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Không thể xóa CV.", { id: toastId });
    }
  };

  // Get filename from Cloudinary secure_url
  const getFileName = (url: string) => {
    try {
      const decoded = decodeURIComponent(url);
      const parts = decoded.split("/");
      const lastPart = parts[parts.length - 1];
      // strip cloudinary hash prefix if any (e.g. my_cv_12345.pdf)
      return lastPart || "CV_Profile_Active.pdf";
    } catch {
      return "CV_Profile_Active.pdf";
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-md flex flex-col items-center justify-center py-12">
        <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
        <p className="text-2xs text-slate-500 mt-2">Đang tải hồ sơ CV...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 backdrop-blur-md space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-500" />
          Quản Lý CV Ứng Viên
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Tải lên CV bản mới nhất của bạn để các Nhà tuyển dụng trên PawBook có thể tiếp cận trực tiếp.
        </p>
      </div>

      {!cvUrl ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? "border-blue-500 bg-blue-500/5"
              : "border-slate-800 bg-slate-950/20 hover:border-slate-700 hover:bg-slate-950/30"
          } ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={uploading}
          />
          {uploading ? (
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
                <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-slate-200">Đang tải lên tài liệu...</p>
              <p className="text-3xs text-slate-500">Đang truyền dữ liệu qua Cloudinary API...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  <span className="text-blue-400 font-bold hover:underline">Click để chọn file</span> hoặc kéo thả vào đây
                </p>
                <p className="text-3xs text-slate-500 mt-1">Hỗ trợ định dạng PDF, DOCX, DOC dưới 10MB</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Check className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-250 truncate">{getFileName(cvUrl)}</p>
              <p className="text-3xs text-slate-500 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Đã được lưu trữ và bảo mật thành công
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={cvUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors"
              title="Xem CV"
            >
              <Eye className="h-4 w-4" />
            </a>
            <button
              onClick={handleDelete}
              disabled={uploading}
              className="p-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
              title="Xóa CV"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Trust Badge */}
      <div className="bg-slate-950/30 rounded-xl p-3 border border-slate-850 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-3xs text-slate-550 leading-relaxed">
          CV của bạn sẽ được bảo mật hoàn toàn. Chỉ các nhà tuyển dụng có tài khoản **EMPLOYER** đã được admin kiểm duyệt mới có quyền truy cập xem hồ sơ đầy đủ của bạn.
        </p>
      </div>
    </div>
  );
}
