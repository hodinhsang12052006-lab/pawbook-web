"use client";
import { useState } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';

const apiKey = "PFGXbrldYpvja6pFa2tO1gepJ9efvMca";
const gf = new GiphyFetch(apiKey); 

export default function GifPicker({ onGifClick }: { onGifClick: (gifUrl: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');

  const fetchGifs = (offset: number) => {
    if (searchTerm) {
      return gf.search(searchTerm, { offset, limit: 10 });
    }
    // Default trending GIFs
    return gf.trending({ offset, limit: 10 });
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <input 
        type="text"
        placeholder="Tìm kiếm GIF (như Telegram)..."
        className="w-full p-2 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 focus:outline-none focus:border-blue-500 text-xs placeholder-slate-500"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      
      <div className="h-[250px] overflow-y-auto custom-scrollbar flex justify-center">
        {/* Thêm key={searchTerm} để ép Grid re-render khi search đổi */}
        <Grid 
          key={searchTerm}
          width={280} 
          columns={2} 
          fetchGifs={fetchGifs} 
          onGifClick={(gif, e) => {
            e.preventDefault();
            // Lấy link original chất lượng để gửi
            onGifClick(gif.images.original.url);
          }} 
        />
      </div>
    </div>
  );
}
