import { useEffect, useState } from "react";

interface GifPickerProps {
  onSelect?: (url: string) => void;
  onGifClick?: (url: string) => void;
  onClose?: () => void;
}

export default function GifPicker({ onSelect, onGifClick, onClose }: GifPickerProps) {
  const [gifs, setGifs] = useState<string[]>([]);

  useEffect(() => {
    fetch('/meme-data.json')
      .then(res => res.json())
      .then(data => setGifs(data))
      .catch(err => console.error("Lỗi đọc file GIF:", err));
  }, []);

  const handleSelect = (url: string) => {
    if (onSelect) onSelect(url);
    if (onGifClick) onGifClick(url);
    if (onClose) onClose();
  };

  return (
    <div className="p-2 h-64 overflow-y-auto grid grid-cols-2 gap-2 bg-slate-900/60 border border-slate-800 rounded-xl custom-scrollbar">
      {gifs.length === 0 ? (
        <p className="text-slate-400 text-center col-span-2 py-8 text-xs font-semibold">Đang nạp Meme...</p>
      ) : null}
      {gifs.map((url, idx) => (
        <img
          key={idx}
          src={url}
          alt="gif"
          loading="lazy"
          className="w-full h-24 object-cover cursor-pointer hover:opacity-80 rounded-xl border border-slate-800 transition-all duration-300 hover:scale-103 hover:border-slate-700"
          onError={(e) => {
            e.currentTarget.style.display = 'none'; // Ẩn ảnh lỗi
          }}
          onClick={() => handleSelect(url)}
        />
      ))}
    </div>
  );
}
