-- 2026-10-24: 4 ảnh vẽ ngày 23/10 lọt qua KHÔNG được chấm (máy chấm hết giờ → code cũ vẫn nhận ảnh; đã sửa:
-- không chấm được thì không đăng). Soi tay cả 4 ở cỡ đầy đủ → ẩn 2 ảnh lỗi:
--   • "French trắng sữa nền xanh navy": có chữ lạ AI vẽ cạnh móng giữa + chỉ 3 ngón dài bất thường
--   • "Mắt mèo cam cháy": vẽ sọc vàng, KHÔNG có hiệu ứng mắt mèo (sai mô tả)
-- KHÔNG xoá: link ảnh cũ lưu trong prompt [hid:URL]; mẫu tự vẽ lại bằng bộ chấm.
UPDATE "NailDesign" SET prompt = prompt || '[hid:https://res.cloudinary.com/wwtkzrvp/image/upload/v1792763504/pawbook/designs/eun5hbtbphwhnquwuuz2.jpg]', imageUrl = NULL WHERE id = 'cmvl137hi0001l307ciu8hd4d' AND imageUrl = 'https://res.cloudinary.com/wwtkzrvp/image/upload/v1792763504/pawbook/designs/eun5hbtbphwhnquwuuz2.jpg';
UPDATE "NailDesign" SET prompt = prompt || '[hid:https://res.cloudinary.com/wwtkzrvp/image/upload/v1792763530/pawbook/designs/q27pfuzginqre5u3cau6.jpg]', imageUrl = NULL WHERE id = 'cmvl137i70002l307qjk2uma6' AND imageUrl = 'https://res.cloudinary.com/wwtkzrvp/image/upload/v1792763530/pawbook/designs/q27pfuzginqre5u3cau6.jpg';
-- Bài "✨ 4 mẫu nail" dùng 2 ảnh lỗi trên → chuyển về nháp (KHÔNG xoá; khôi phục: status = published).
UPDATE "Post" SET status = 'draft' WHERE id = 'c6f891a4bcc2dffec84a482a1' AND status = 'published' AND content LIKE '✨ 4 mẫu nail%';
