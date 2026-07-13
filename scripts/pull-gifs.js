const fs = require('fs');

const premiumGifs = [
  "https://media.giphy.com/media/11ISwbgCxEzMyY/giphy.gif", // Cười lớn
  "https://media.giphy.com/media/3o6Zt4HU9uwXmXSAuI/giphy.gif", // Khóc
  "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif", // Suy nghĩ
  "https://media.giphy.com/media/l41lFw057lAJQMwg0/giphy.gif", // Wow
  "https://media.giphy.com/media/VbnUQpnihPSIgIXuZv/giphy.gif", // OK
  "https://media.giphy.com/media/xT0GqssRweIhlz209i/giphy.gif", // Chào
  "https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif", // Buồn
  "https://media.giphy.com/media/wW95fEq09hOI8/giphy.gif", // Nhảy múa
  "https://media.giphy.com/media/5Govl2ixf25Co/giphy.gif", // Vui vẻ
  "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif", // Giận dữ
  "https://media.giphy.com/media/12PA1eI8FBqEUM/giphy.gif", // Mèo cười
  "https://media.giphy.com/media/yY381Zs22w0aA/giphy.gif", // Chó vui mừng
  "https://media.giphy.com/media/mCRJDo24UvJMA/giphy.gif", // Bất ngờ
  "https://media.giphy.com/media/l3q2K1gTR6t7HYgIW/giphy.gif", // Vỗ tay
  "https://media.giphy.com/media/26gspvTRJXnl8Gs5G/giphy.gif", // Like
  "https://media.giphy.com/media/3o7abKhOpu0NXS3lU4/giphy.gif", // Sốc
  "https://media.giphy.com/media/3o8dFn5NXgnmQvkGOA/giphy.gif", // Không đồng ý
  "https://media.giphy.com/media/26AHON4yhyC59gU48/giphy.gif", // Đồng ý
  "https://media.giphy.com/media/l0Exk8EUzYsr6jUhy/giphy.gif", // Chào quân đội
  "https://media.giphy.com/media/3orif8f8IV2wx4iw4U/giphy.gif"  // Hét lên
];

try {
  console.log("🔥 Đang lưu 20 Meme GIFs tĩnh đã tuyển chọn vào public/meme-data.json...");
  fs.writeFileSync('./public/meme-data.json', JSON.stringify(premiumGifs, null, 2));
  console.log(`✅ Thành công! Đã chốt sổ ${premiumGifs.length} ảnh GIF.`);
} catch (error) {
  console.error("❌ Lỗi khi ghi file:", error);
}
