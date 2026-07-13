import React from "react";

export default function GifPicker({ onGifClick, onClose }: { onGifClick: (url: string) => void, onClose?: () => void }) {
  const TELEGRAM_GIFS = [
    "https://media.giphy.com/media/11ISwbgCxEzMyY/giphy.gif", // Cười
    "https://media.giphy.com/media/3o6Zt4HU9uwXmXSAuI/giphy.gif", // Khóc
    "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif", // Suy nghĩ
    "https://media.giphy.com/media/l41lFw057lAJQMwg0/giphy.gif", // Wow
    "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif", // OK
    "https://media.giphy.com/media/xT0GqssRweIhlz209i/giphy.gif", // Chào
    "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif", // Giận
    "https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif", // Buồn
    "https://media.giphy.com/media/wW95fEq09hOI8/giphy.gif", // Dance
    "https://media.giphy.com/media/5Govl2ixf25Co/giphy.gif", // Happy
  ];

  return (
    <div className="p-2 h-64 overflow-y-auto grid grid-cols-2 gap-2 bg-slate-900/60 rounded-xl custom-scrollbar border border-slate-800/80">
      {TELEGRAM_GIFS.map((url, idx) => (
        <img
          key={idx}
          src={url}
          alt="gif"
          className="w-full h-24 object-cover cursor-pointer hover:opacity-80 rounded-xl border border-slate-800 transition-all duration-300 hover:scale-103"
          onClick={() => {
            onGifClick(url);
            if (onClose) onClose();
          }}
        />
      ))}
    </div>
  );
}
