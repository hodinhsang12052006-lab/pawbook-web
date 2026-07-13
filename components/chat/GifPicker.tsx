import React from "react";

const PERMANENT_GIFS = [
  "https://media.tenor.com/PZzXj23J590AAAAC/okay-ok.gif",
  "https://media.tenor.com/y1Xz97E98XMAAAAC/ch%C3%B3-ch%C3%B3-c%C6%B0%E1%BB%9Di.gif",
  "https://media.tenor.com/7L4a8_xZ4tQAAAAC/c%C3%B2n-c%C3%A1i-n%E1%BB%8Bt-ti%E1%BA%BFn-b%E1%BB%8Bp.gif",
  "https://media.tenor.com/gK9qC-d69PMAAAAC/huhu-crying.gif",
  "https://media.tenor.com/9vB4DttQk7UAAAAC/sad-cat.gif",
  "https://media.tenor.com/k6Pq-b5y_1EAAAAC/what-cat-what.gif",
  "https://media.tenor.com/7T0P4H3mFzUAAAAC/clapping-leonardo-dicaprio.gif",
  "https://media.tenor.com/mS9hU_uS88kAAAAC/dog-doge.gif",
  "https://media.tenor.com/1O8kK967rK0AAAAC/cat-dance.gif",
  "https://media.tenor.com/R_YjGZ7L_z4AAAAC/thumbs-up-cat.gif",
  "https://media.tenor.com/r33lOikv7B0AAAAC/pepe-sad-pepe-crying.gif",
  "https://media.tenor.com/N1_QcEa-u08AAAAC/huh-cat.gif"
];

interface GifPickerProps {
  onSelect?: (url: string) => void;
  onGifClick?: (url: string) => void;
  onClose?: () => void;
}

export default function GifPicker({ onSelect, onGifClick, onClose }: GifPickerProps) {
  const handleSelect = (url: string) => {
    if (onSelect) onSelect(url);
    if (onGifClick) onGifClick(url);
    if (onClose) onClose();
  };

  return (
    <div className="p-2 h-64 overflow-y-auto grid grid-cols-2 gap-2 bg-[#0b1426] rounded-lg border border-slate-700">
      {PERMANENT_GIFS.map((url, idx) => (
        <div 
          key={idx} 
          className="relative w-full h-24 cursor-pointer hover:opacity-80 rounded overflow-hidden" 
          onClick={() => handleSelect(url)}
        >
          <img 
            src={url} 
            alt="gif" 
            loading="lazy" 
            className="w-full h-full object-cover" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
          />
        </div>
      ))}
    </div>
  );
}
