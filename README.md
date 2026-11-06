# TikTok Live – Chánh điện trực tuyến (overlay)

Overlay cho phiên live TikTok dạng "đi chùa online":

| Sự kiện TikTok | Hiển thị trên overlay |
|---|---|
| Người xem vào phòng | Nhân vật có avatar + tên đi từ cửa vào, ngồi xuống bồ đoàn, chắp tay "Nam mô A Di Đà Phật" |
| Tặng quà | Banner "X dâng N × quà", nhân vật phát sáng, hoa sen bay lên. Quà lớn → mưa cánh sen, hào quang toả từ bàn thờ |
| Comment | Bong bóng chat trên đầu nhân vật |
| Like / Share | Tim / lấp lánh bay lên từ nhân vật |
| Follow | Banner "đã theo dõi · Chúc an lạc" |

- **Bảng công đức**: top 3 người tặng nhiều 💎 nhất. Ai đạt ≥100 💎 thành VIP (viền vàng, không bị mời ra khi đầy chỗ).
- **28 chỗ ngồi**: khi đầy, người không tương tác lâu nhất sẽ đứng dậy đi ra để nhường chỗ.
- Cấp hiệu ứng quà (💎 × số lượng): `<10` nhỏ · `10–99` mưa sen · `100–999` + hào quang · `≥1000` hào quang kép.

## Overlay 3D 「ビー玉レース」 – đua bi (`/race.html`, Three.js)

- **Phòng chờ (mặc định 20 giây):** comment bất kỳ → viên bi thủy tinh mang avatar xếp hàng ở vạch START.
- **Đua (~45 giây):** bi lăn xuống đường đua xoắn ốc có vòng sáng và cối xay cản đường. Camera tự khung đoạn đường có nhiều bi nhất.
- Comment 「ジャンプ」 (mỗi người 3 giây/lần) → nhảy né cối xay và vũng dầu. Like → tăng tốc nhẹ.
- **Quà** (💎 × số lượng, mỗi mức = 1 hiệu ứng cố định):

| 💎 | Hiệu ứng |
|---|---|
| 1–4 | 🔥 ニトロ 2 giây |
| 5–29 | 🛢️ Thả dầu phía sau → bi đi sau trượt |
| 30–99 | 🚀 Tên lửa bắn bi ngay phía trước (đang dẫn đầu thì bắn bi thứ 2) |
| 100–499 | 🛡️ Khiên chặn 1 đòn + ニトロ 3 giây |
| 500–999 | ⚡ Sét đánh 3 bi dẫn đầu (trừ người tặng) |
| ≥1000 | 🌀 Dịch chuyển lên trước 12% đường + khiên |

- Chưa tham gia mà tặng quà trong lúc đua → vào đua từ cuối đoàn.
- Về đích: slow-motion + "GOAL!", top 3 lên bục, lưu số lần vô địch.
- Avatar được server tải hộ qua `/avatar?u=` (WebGL cần ảnh cùng nguồn), chỉ cho phép domain ảnh TikTok và `pravatar.cc` (demo).
- Tham số URL: `?lobby=20`.

```bash
npm run demo:race
```

Live thật: `node server.js ten_tiktok --race`.

## Overlay câu cá cho thị trường Nhật – 「みんなで釣り大会 × ヌシ釣りバトル」 (`/fishing.html`)

**Câu cá thường (miễn phí, luôn chạy):** comment 「釣る」 → phao mang avatar thả xuống nước → cá cắn → cá ngẫu nhiên (16 loại, 5 độ hiếm) + kích thước. Ghi vào 図鑑 cá nhân, bảng 今日の最大魚, cá hiếm → thẻ 魚拓.

**Trận ヌシ (mặc định 5 phút/lần, 75 giây/trận):**
- Comment 「釣」 vào 釣りチーム (giúp streamer), 「魚」 vào 魚チーム (妨害).
- Streamer bấm **Space / Enter / ↑** liên tục để kéo cần. Comment và like của thành viên cũng kéo về phe mình.
- Quà (mỗi quà = 1 hiệu ứng cố định, không ngẫu nhiên):

| 💎 | 魚チーム | 釣りチーム |
|---|---|---|
| <30 | 暴れる | 巻き上げ |
| 30–99 | 糸が絡まる (khoá phím streamer 3 giây) | タモ網 |
| ≥100 | 大暴れ (rung màn hình) | 助っ人の船 (x2 trong 8 giây) |

- 15 giây cuối x2. Người tặng quà chưa chọn phe → tự vào phe đang thua.
- Câu được → 魚拓 khổng lồ ghi tên MVP. Cá thoát → 「ヌシの守護者」 chọn 罰ゲーム (comment 1–4, hết 9 giây thì tự chọn).

Tham số URL: `?boss=300` (giây giữa các trận), `?battle=75`, `?autoreel=1` (tự kéo, dùng khi demo).

Streamer cần bấm phím → mở trang trong **cửa sổ trình duyệt thường** và dùng Window Capture trong OBS (Browser Source không nhận phím).

```bash
npm run demo:fishing
```

Live thật: `node server.js ten_tiktok --fishing`.

## Overlay "Lễ Đường Tình Yêu" – ghép đôi (`/wedding.html`)

Vòng chơi (mặc định 3 phút/lễ):
1. Vào phòng → ngồi hàng **khách mời**.
2. Comment `trai` / `gái` → về ghế **nhà trai** / **nhà gái** (đổi trang phục theo phe).
3. Comment `cưới` → đăng ký ghép đôi (💗 trên avatar). Chỉ người đã đăng ký mới được bốc. `huỷ` để rút.
4. Hết giờ → màn hình tối, spotlight quét rồi chọn 1 trai + 1 gái → cô dâu chú rể đi lên lễ đường.
5. Cả phòng comment `đồng ý` trong 25s để lấp thanh chúc phúc → thành đôi (nhẫn, pháo giấy, lưu vào "Cặp đôi đã thành"). Không đủ → "Cô dâu bỏ chạy 🏃‍♀️".

Quà:
- Quà bất kỳ = **tiền mừng cưới** cho cặp đang làm lễ (ngoài giờ lễ thì góp vào quỹ cho cặp sau).
- Quà ≥ 299💎 trong lúc làm lễ = **cướp dâu / cướp rể**: người tặng chạy lên thay chỗ (nhà trai thay chú rể, nhà gái thay cô dâu), phiếu đồng ý giảm một nửa, cộng thêm 10s.

Tham số URL: `?interval=180` (giây giữa các lễ), `?steal=299` (💎 để cướp).

```bash
npm run demo:wedding
```

Live thật: `node server.js ten_tiktok --wedding`.

## Overlay Noel – "Cùng thắp sáng cây thông" (`/noel.html`)

| Sự kiện TikTok | Hiển thị |
|---|---|
| Vào phòng | Quả châu mang avatar bay lên treo trên cây thông + nhân vật đội mũ Noel trượt băng dưới gốc cây |
| Comment | Thiệp lời chúc treo cạnh quả châu của người đó |
| Tặng quà | Banner, hộp quà rơi xuống gốc cây, quả châu phát sáng, nhân vật xoay vòng. Quà lớn → bão tuyết, pháo hoa, xe tuần lộc bay ngang trời |
| Like / Share | Tim, bông tuyết, lấp lánh bay lên |
| Follow | Banner "Giáng Sinh an lành" |

- Thanh tiến độ 💎: đèn trên cây sáng dần theo tiến độ. Đạt mục tiêu → ngôi sao sáng, pháo hoa, bão tuyết, rồi mục tiêu tiếp theo tăng 50%.
- Đặt mục tiêu: `?goal=3000` (mặc định 1000). Chip đếm ngược số ngày tới Giáng Sinh tự tính theo ngày hiện tại.
- Tối đa ~34 quả châu và 14 người trượt băng; khi đầy, người không tương tác lâu nhất nhường chỗ.

```bash
npm run demo:noel
```

Live thật: `node server.js ten_tiktok --noel` → `http://localhost:8787/` mở thẳng overlay Noel.

## Cài đặt

Yêu cầu Node.js 18+.

```bash
npm install
```

## Chạy

Chạy thử với sự kiện giả (không cần đang live):

```bash
npm run demo
```

Kết nối phiên live thật (thay `ten_tiktok` bằng username đang live, không cần `@`):

```bash
node server.js ten_tiktok
```

Mở `http://localhost:8787/` để xem. Đổi tiêu đề: `http://localhost:8787/?title=CHÙA%20AN%20LẠC`

## Gắn vào OBS / TikTok LIVE Studio

1. Settings → Video: đặt canvas **1080×1920** (dọc).
2. Thêm source **Browser** → URL `http://localhost:8787/`, Width `1080`, Height `1920`.
3. Đặt source này lên trên cùng (hoặc làm nền, rồi đặt camera lên trên).

Với TikTok LIVE Studio: thêm source loại **Link / Browser** với URL như trên.

## Lưu ý

- `tiktok-live-connector` là thư viện **không chính thức** (TikTok không có API public cho live). Có thể ngừng hoạt động khi TikTok thay đổi; khi đó chạy `npm update tiktok-live-connector`.
- Server tự kết nối lại khi mất kết nối hoặc khi chưa live.
- Đổi port: `PORT=9000 node server.js ten_tiktok`.

## Cấu trúc

```
server.js            Kết nối TikTok, chuẩn hoá sự kiện, đẩy qua WebSocket (/ws); demo mode
public/overlay.html  Khung cảnh chánh điện
public/overlay.css   Giao diện, animation
public/overlay.js    Logic nhân vật, chỗ ngồi, hiệu ứng quà, bảng công đức
```

Test thủ công trong DevTools của trang overlay:

```js
temple.emit({ type: 'gift', user: { id: 'u1', nickname: 'An', avatar: '' }, giftName: 'Hoa sen', diamonds: 500, count: 2 })
```
