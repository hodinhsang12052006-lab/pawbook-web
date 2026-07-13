const fs = require('fs');

async function pullGifs() {
  let apiKey = 'PFGXbrldYpvja6pFa2tO1gepJ9efvMca';
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const match = envContent.match(/NEXT_PUBLIC_GIPHY_API_KEY\s*=\s*(.*)/);
    if (match && match[1]) {
      apiKey = match[1].replace(/['"\r]/g, '').trim();
    }
  } catch (e) {
    // Ignore and use default fallback key
  }

  const fallbackGifs = [
    "https://media.giphy.com/media/11ISwbgCxEzMyY/giphy.gif",
    "https://media.giphy.com/media/3o6Zt4HU9uwXmXSAuI/giphy.gif",
    "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
    "https://media.giphy.com/media/l41lFw057lAJQMwg0/giphy.gif",
    "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif",
    "https://media.giphy.com/media/xT0GqssRweIhlz209i/giphy.gif",
    "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif",
    "https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif",
    "https://media.giphy.com/media/wW95fEq09hOI8/giphy.gif",
    "https://media.giphy.com/media/5Govl2ixf25Co/giphy.gif"
  ];

  const query = "meme viet nam";
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=100&rating=pg-13`;
  
  try {
    console.log("⏳ Đang cào 100 Meme GIFs từ Giphy...");
    const res = await fetch(url);
    const json = await res.json();
    let gifUrls = [];
    if (json && Array.isArray(json.data) && json.data.length > 0) {
      gifUrls = json.data.map(gif => gif.images.fixed_height.url);
    } else {
      console.log("⚠️ Giphy không trả về data, sử dụng danh sách GIFs dự phòng.");
      gifUrls = fallbackGifs;
    }
    
    fs.writeFileSync('./public/meme-data.json', JSON.stringify(gifUrls, null, 2));
    console.log(`✅ Đã cào thành công và lưu ${gifUrls.length} GIFs vào public/meme-data.json`);
  } catch (error) {
    console.error("❌ Lỗi khi cào GIF, sử dụng danh sách GIFs dự phòng:", error);
    fs.writeFileSync('./public/meme-data.json', JSON.stringify(fallbackGifs, null, 2));
  }
}
pullGifs();
