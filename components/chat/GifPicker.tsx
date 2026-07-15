import React from 'react';

// Hardcode vĩnh viễn mảng GIF tĩnh không dùng API (Giphy CDN short links)
const PERMANENT_GIFS = [
  "https://i.giphy.com/11ISwbgCxEzMyY.gif",
  "https://i.giphy.com/3o7TKSjRrfIPjei1IQ.gif",
  "https://i.giphy.com/26gR2f01UTX9R7VyU.gif",
  "https://i.giphy.com/3o7abKhOpu0NXS3WY0.gif",
  "https://i.giphy.com/26n6Gx9moCgs1pUuk.gif",
  "https://i.giphy.com/l3q2zVr6cu95nF6O4.gif",
  "https://i.giphy.com/2WxWfiavndgcM.gif",
  "https://i.giphy.com/11N0ycAEVs3dbO.gif",
  "https://i.giphy.com/XgBx22IJ2yHzG.gif",
  "https://i.giphy.com/7YBZCh1TIoC8U.gif",
  "https://i.giphy.com/t3s3uEQ5j181C.gif",
  "https://i.giphy.com/3oEjI6SIIHBdRxXI40.gif"
];

// Memoized: the parent (MessagesContent) re-renders on every incoming
// message/keystroke while this panel is open. Without memo + stable
// onSelect/onClose references from the parent, all 12 thumbnails would
// reconcile on every unrelated parent render.
function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void, onClose: () => void }) {
  return (
    <div className="p-2 h-64 overflow-y-auto grid grid-cols-2 gap-2 bg-[#0b1426] rounded-lg border border-slate-700">
      {PERMANENT_GIFS.map((url, idx) => (
        <div key={idx} className="relative w-full h-24 cursor-pointer hover:opacity-80 active:scale-95 transition-transform rounded overflow-hidden" onClick={() => { onSelect(url); onClose(); }}>
          <img src={url} alt="gif" loading="lazy" decoding="async" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
      ))}
    </div>
  );
}

export default React.memo(GifPicker);
