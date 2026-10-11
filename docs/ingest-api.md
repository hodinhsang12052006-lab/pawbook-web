# Nối tool lọc bài → PawNail (đăng hộ tiệm)

Tool của bạn gửi bài tuyển thợ (tiệm đã nhờ đăng) lên PawNail. PawNail tự tách
**SĐT, tên tiệm, địa chỉ, ZIP → bang/thành phố, lương, kỹ năng, chỗ ở, tin gấp**, chống trùng,
và ẩn tin sau **14 ngày** kể từ ngày bài gốc đăng.

- Địa chỉ: `POST https://www.bitpawos.com/api/ingest/jobs`
- Khoá: header `Authorization: Bearer <INGEST_KEY>` — khoá nằm trong file `.env.ingest.local`
  (máy của bạn, không commit). **Không dán khoá vào nhóm/chat công khai.**
- Tối đa **200 bài / lần gửi**. Nhiều hơn thì chia nhiều lần.

## Gửi bài (Python)

```python
import os, requests

KEY = os.environ["PAWNAIL_INGEST_KEY"]          # lấy trong .env.ingest.local
URL = "https://www.bitpawos.com/api/ingest/jobs"

posts = [
    {
        "text": "CẦN GẤP THỢ BỘT ... Gọi (832) 555-0187",   # nguyên văn bài (bắt buộc nếu không gửi các trường bên dưới)
        "sourceUrl": "https://www.facebook.com/groups/.../posts/...",  # chỉ admin thấy
        "postedAt": "2026-10-11T08:30:00Z",          # ngày bài gốc đăng (ISO) — bài > 14 ngày bị bỏ qua
        # Trường tool ĐÃ TÁCH SẴN (nếu có) — được ưu tiên hơn kết quả PawNail tự tách:
        # "phone": "(832) 555-0187", "salonName": "Sunny Nails & Spa",
        # "address": "8800 Bellaire Blvd Ste 200", "city": "Houston", "state": "TX", "zip": "77036",
        # "market": "US", "salary": "$1,300-1,600/tuần",
    },
]

for i in range(0, len(posts), 200):
    r = requests.post(URL, json={"posts": posts[i:i + 200]}, headers={"Authorization": f"Bearer {KEY}"}, timeout=60)
    r.raise_for_status()
    out = r.json()
    print(f"tạo mới {out['created']} · cập nhật {out['updated']} · bỏ qua {out['skipped']}")
    for x in out["results"]:
        if x["status"] == "skipped":
            print("  bỏ qua bài", i + x["i"], "→", x["reason"])
```

## Định dạng của tool: `POST /api/jobs/sync`

Cùng khoá (header `Authorization: Bearer <KEY>` **hoặc** `x-api-key: <KEY>`). Gửi 1 bài (object), mảng, hoặc `{ "posts": [...] }` (≤ 200).

```python
requests.post("https://www.bitpawos.com/api/jobs/sync", headers={"x-api-key": KEY}, timeout=60, json={
    "title": "Cần tuyển Thợ Bột / Acrylic, Chân Tay Nước - Houston, TX 77083",
    "salon_name": "Diamond Nails",
    "phone": "(832) 555-0199",
    "facebook_url": "https://www.facebook.com/profile.php?id=...",   # chỉ để nhận ra cùng tiệm — lưu dạng mã băm
    "location": "Houston, TX 77083",
    "state": "TX",
    "salary": "$1,500/tuần",
    "skills": ["Thợ Bột / Acrylic", "Chân Tay Nước"],
    "content": "Toàn bộ nội dung bài đăng...",
    "post_url": "https://facebook.com/groups/.../posts/...",
    "country": "Mỹ (USA)",          # hoặc "Úc"
    # "posted_at": "2026-10-11T08:30:00Z",   # (không bắt buộc) ngày bài gốc
})
```

Trả về (1 bài): `{"status": "created|bumped|updated|skipped", "job_id": "...", "repost_count": 2, "reason": null}`
- **created** (HTTP 201): tiệm mới → tạo tin, `repost_count = 1`.
- **bumped**: cùng **SĐT** hoặc cùng **Facebook người đăng** mà là **bài mới** → KHÔNG tạo tin mới: đẩy tin lên đầu,
  `repost_count + 1`, `last_reposted_at = bây giờ`, nội dung mới nhất.
- **updated**: tool gửi lại **đúng bài cũ** (cùng `post_url`) → chỉ cập nhật, không tính là đăng lại.
- **skipped** (HTTP 422) + `reason`.

Danh sách việc: `GET /api/jobs?state=TX&q=...` — `q` tìm trong tiêu đề, tên tiệm, thành phố, kỹ năng, nội dung;
tin mới nhất / vừa được đăng lại nằm trên cùng. Trên web: ô 🔍 ở tab Việc làm.

## Kết quả của `/api/ingest/jobs`

Kết quả mỗi bài: `created` (tin mới) · `updated` (cùng SĐT đã có tin → làm mới) · `skipped` + lý do:
không phải bài tuyển thợ · không có SĐT Mỹ/Úc · không xác định được bang · bài cũ hơn 14 ngày ·
tiệm đã yêu cầu gỡ tin.

Xem thống kê: `GET https://www.bitpawos.com/api/ingest/jobs` (cùng header) → số tin đang hiện / hết hạn / theo bang.

## Trên PawNail
- Tin hiện nhãn **“Đăng hộ tiệm”**, nút chính **Gọi ngay** (tiệm chưa dùng app nên không nhắn trong app).
- Địa chỉ có nút **Bản đồ**. Không khai cho Google for Jobs (Google chỉ nhận tin chủ tiệm tự đăng).
- Tiệm bấm **“Tôi là chủ tiệm này”** → admin chuyển tin sang tài khoản chủ tiệm (thành người dùng thật).
- Tiệm bấm **“Gỡ tin này”** → admin duyệt ở Studio → tin bị gỡ và **số đó không bao giờ được đăng lại**.
- Đăng tay từng bài: Admin → Studio → **Đăng hộ tiệm** (dán bài → Xem trước → Đăng hộ).
