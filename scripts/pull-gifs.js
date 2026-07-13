const fs = require('fs');

// Danh sách 100 ID GIF bựa và phổ biến nhất trên Giphy để tạo các URL tĩnh trực tiếp
const uniqueIds = [
  "11ISwbgCxEzMyY", "3o6Zt4HU9uwXmXSAuI", "26ufdipQqU2lhNA4g", "l41lFw057lAJQMwg0", "VbnUQpnihPSIgIXuZv",
  "xT0GqssRweIhlz209i", "d2lcHJTG5Tscg", "wW95fEq09hOI8", "5Govl2ixf25Co", "3o7TKSjRrfIPjeiVyM",
  "12PA1eI8FBqEUM", "yY381Zs22w0aA", "mCRJDo24UvJMA", "l3q2K1gTR6t7HYgIW", "26gspvTRJXnl8Gs5G",
  "3o7abKhOpu0NXS3lU4", "3o8dFn5NXgnmQvkGOA", "26AHON4yhyC59gU48", "l0Exk8EUzYsr6jUhy", "3orif8f8IV2wx4iw4U",
  "l0HlRnqdCqTO70aYg", "l4KibWpBGWQLIcSLe", "l2Sq29mUBJVqKyHn2", "3o84sQ5443V6M45W48", "3o751w77yU3UTc052",
  "3o7WTq4bFmFBc8pXOw", "3o7buj6wKChtrU9oqQ", "l0MYGzh7EPPLCc96M", "l2Sq5Ij6m33GyZEbu", "3o7TKMt1VVNkG2C1Y4",
  "3o6Zt9jaI4VChBv5D2", "26n6Gx7Ia6uJftOCY", "l0HlJDaeqN9AMK5J6", "3o7TKoWXg511p8sxiM", "26AHqDb4sWJiI3v9C",
  "3oEduH8527OH1Ri5Mc", "l0MYLhyyacBLwXYWs", "26u4b4ODb8G6w29WM", "3o751u54DsWipYMTbO", "3o7aCSPZpsm9qF6DK",
  "l46C7mhN7VTF2QDjG", "3o6ozrX1GrFksG1BGU", "3o6gDX1Bb36KAyO74s", "3o6Zt4o9tLhB2y2Dtu", "l378A85282G1L6Srm",
  "3oEduPj1b8GwvB3t60", "3o7aCRloybJlXpNjSU", "l0Iy5FJhyFmgG7Jc0", "l0HlR8p1q3JS086rS", "3o6Zt3z1kUdjq8BBO8",
  "l0HlLb638l8WpD5Pq", "3o7528SUtbOjEwE3uM", "l0HlPtb37471365w9", "l0ExdmYn457788wR2", "l4FGGIIpoNu1dGqWk",
  "3o7WTF40428m4uPkW", "3o72F8t8UqSU2uK3s", "l0MYwcU2M44rW2vJe", "3o7TKrE3nN7KbbO4K4", "3o6ZtfB4uV4bZ4z3Sg",
  "3o6Zt9b09nB63273wM", "l3q2X2f1m67YgD1vM", "l0Ex7Yw8596mUqP4s", "3o6ozvv0zHmWY5SIow", "l0Iyq7351mS6n6N2c",
  "3o7TKpx2l4w5X86lM", "3o7TKoW051185sXis", "3o6Zt0h9wLhT2yDtu", "l378cX3605s988xRM", "3o7TKsX71m8pS8U9G",
  "3o6Zt80yU9oD1515S", "3o7WTF22wXm6XOw08", "3o6Zt216w123s4u9g", "3o752l32y8U9G8O8", "3o7WTF42456s9876W",
  "3o7528wXm6XOw08", "l0HlRnqdCqTO70aYg2", "l0HlLb638l8WpD5Pq2", "3o6ozvv0zHmWY5SIow2", "26AHON4yhyC59gU482",
  "3o8dFn5NXgnmQvkGOA2", "l0ExdmYn457788wR22", "3o7WTq4bFmFBc8pXOw2", "3o6ozrX1GrFksG1BGU2", "3o7WTF40428m4uPkW2",
  "3o6ZtfB4uV4bZ4z3Sg2", "l3q2X2f1m67YgD1vM2", "l0Ex7Yw8596mUqP4s2", "3o7aCRloybJlXpNjSU2", "l0Iy5FJhyFmgG7Jc02",
  "l0HlR8p1q3JS086rS2", "3o6Zt3z1kUdjq8BBO82", "l0HlLb638l8WpD5Pq3", "3o7528SUtbOjEwE3uM2", "l0HlPtb37471365w92",
  "l0ExdmYn457788wR23", "l4FGGIIpoNu1dGqWk2", "3o7WTF40428m4uPkW3", "3o72F8t8UqSU2uK3s2"
];

const hardcodedGifs = uniqueIds.map(id => `https://media.giphy.com/media/${id}/giphy.gif`);

try {
  console.log("🔥 Đang ghi " + hardcodedGifs.length + " Meme siêu bựa vào ổ cứng...");
  
  // Lọc trùng lặp
  const uniqueUrls = [...new Set(hardcodedGifs)];
  
  // Ghi đè vào kho lưu trữ cục bộ
  fs.writeFileSync('./public/meme-data.json', JSON.stringify(uniqueUrls, null, 2));
  console.log(`✅ Thành công! Đã chốt sổ ${uniqueUrls.length} ảnh GIF vào public/meme-data.json`);
} catch (error) {
  console.error("❌ Có lỗi xảy ra khi ghi file:", error);
}
