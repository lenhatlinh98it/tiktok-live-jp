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

## Overlay 「釣り船ライブ」 – thuyền câu ra biển (`/sea.html`, 2D canvas) ⭐ bản mới nhất

Cùng toàn bộ cơ chế của 「釣り堀ライブ」 (bên dưới), đổi sang góc nhìn mặt cắt ngang biển:
- Nền `public/sea/bg.jpg` và thuyền `public/sea/boat.png` (tạo bằng AI). Thuyền bập bềnh trên mặt nước.
- **16 chỗ** trên boong (2 hàng so le). Mỗi người có cần câu; dây câu thả xuống **độ sâu theo độ hiếm** của con cá sắp cắn (★1 nông → ★5 sát đáy).
- Cá dùng ảnh thật trong `public/fish/` (**37 loài**: rác 3, ★1 9, ★2 8, ★3 8, ★4 5, ★5 4 – tạo bằng AI từ 2 sheet), bơi ngang theo tầng; ★3+ phát sáng.
- Mồi đang dùng hiện ở cuối dây khi chờ cá (🦐/🪱/🦑/tôm vàng/ngọc cầu vồng); mồi trả phí phát sáng + lấp lánh; nhận quà có hiệu ứng「装着！」. Cá bơi tới móc → cắn → ファイト (người câu rung theo) → kéo dọc dây lên mặt nước → nhảy lên thuyền.
- 黄金タイム / 撒き餌 phủ màu lên vùng nước; 撒き餌 thêm đàn cá và bọt nước.
- Đơn vị quà là **coin** (số coin người xem trả cho món quà). Thư viện gọi trường này là `diamondCount` / `diamond_count`, nhưng README của thư viện dùng nó làm giá quà (`cost`). Các bảng 💎 trong README này cũng hiểu là coin.
- **Quà = mồi + cần** (khác bản hồ):

| 💎 | Mồi (quyết định cá nào cắn) | Cần (giảm tỉ lệ xổng) |
|---|---|---|
| 1–9 | 🪱 特製エサ ×5 – không ra rác | — |
| 10–99 | 🦑 高級エサ ×5 – ★2 trở lên | 🎣 カーボン竿 ×10 – xổng ×0.6 |
| 100–499 | ✨ 金のエサ ×5 – ★3 trở lên | 🥇 金の竿 ×15 – xổng ×0.35 |
| ≥500 | 👑 伝説のエサ ×3 – ★4 trở lên | 🔱 伝説の竿 ×10 – xổng ×0.15 |

- **Cá xổng (バラシ):** tỉ lệ cơ bản ★1 15% → ★5 55%, nhân với hệ số của cần. Xổng thì dây đứt「プツン」, cá phóng đi; ★4/★5 xổng có banner gợi ý cần xịn. **Mồi trả phí không bị trừ khi cá xổng** (chỉ trừ khi câu được); cần bị trừ mỗi lần câu.
- **巨大魚の群れ (quà ≥1000💎):** rung màn hình, đàn cá khủng tràn qua, **mọi người trên thuyền đều bị cá cắn** (★3 60% / ★4 32% / ★5 8%, miễn phí cho người được hưởng) → mỗi người tự giữ cá bằng cần của mình → banner tổng kết「大漁！N人中M人が釣り上げた！」.

```bash
npm run demo:sea
```

Live thật: `node server.js ten_tiktok --sea`.

## Overlay 3D 「釣り堀ライブ」 – hồ câu cá (`/pond.html`, Three.js)

- Comment bất kỳ → ngồi vào 1 trong **24 chỗ** quanh hồ (rải đều), hiện avatar + tên + đồ câu đang dùng + số loài trong 図鑑.
- Người đã ngồi **tự động câu liên tục**: chờ (phao thỉnh thoảng nhúc nhích「ちょん…」) → cá có màu theo độ hiếm bơi tới phao → phao giật「!」→ kéo cá「ファイト！」→ cá nhảy lên về phía người câu → nhãn kết quả. Chỉ ★4/★5 hiện thẻ lớn giữa màn hình (có pháo giấy).
- Thời gian chờ theo độ hiếm của cá sắp cắn: ★1 20–40s, ★2 30–55s, ★3 45–75s, ★4 60–100s, ★5 80–130s (rác 15–35s). Thời gian kéo cá: ★1 ~1s → ★5 ~5s. 特製エサ chờ ×0.75, cần trả phí ×0.85. Lần câu đầu sau khi ngồi chờ một nửa. `?speed=3` để test nhanh.
- 22 loại (rác, ★1–★5). Điểm = điểm theo độ hiếm × kích thước. Bảng 「今日のランキング」 và 「最大魚レコード」 lưu theo ngày (localStorage của trình duyệt).
- **Đồ câu từ quà** (mỗi mức bảo đảm độ hiếm tối thiểu, không ra rác; bảng tỉ lệ luôn hiện xen kẽ ở dưới màn hình):

| 💎 | Đồ câu | Số lần | Bảo đảm |
|---|---|---|---|
| Miễn phí | 🎋 竹竿 | ∞ | — (có thể ra rác) |
| 1–9 | 🪱 特製エサ | 5 | Không ra rác, cắn câu nhanh hơn |
| 10–99 | 🎣 カーボン竿 | 10 | ★2 trở lên |
| 100–499 | ✨ 金の竿 | 10 | ★3 trở lên |
| ≥500 | 👑 伝説の竿 | 5 | ★4 trở lên |

- Ảnh cá: `public/fish/<tên>.png` (PNG nền trong suốt, cắt từ sheet tạo bằng AI). Thay ảnh chỉ cần ghi đè file cùng tên; loài nào thiếu ảnh sẽ tự dùng emoji. Bảng tên file ↔ loài nằm ở `FISH_IMG` trong `public/pond.js`.
- **Quà = 即ヒット:** người tặng đang chờ thì cá cắn câu ngay, và lần câu đó dùng luôn đồ câu mới.
- **撒き餌 (quà ≥100💎):** đàn cá kéo tới, mặt nước sủi bọt, 20 giây cả hồ chờ ngắn hơn 60%, banner ghi tên người tặng.
- **黄金タイム:** thanh chung nhận cả like và quà (1💎 = 10 like), đầy 500 (`?golden=`) → 30 giây cả hồ chờ còn một nửa, banner vinh danh người góp nhiều nhất (không đổi tỉ lệ cá).
- Khi đủ 24 chỗ, người dùng đồ miễn phí không tương tác 10 phút sẽ nhường chỗ.
- ⚠️ Cơ chế "quà → tỉ lệ cá hiếm cao hơn" cần luật sư xác nhận trước khi chạy ở Nhật (賭博罪 / 景品表示法).

```bash
npm run demo:pond
```

Live thật: `node server.js ten_tiktok --pond`.

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

## Kiểm tra dữ liệu live thật (chỉ đọc)

```bash
node scripts/probe.js <username_dang_live> 120
```

In cấu trúc vài sự kiện mỗi loại (đã che chuỗi) và thử proxy avatar. Kết quả kiểm tra ngày 2026-11-09 với `tiktok-live-connector` 2.5.0:
- Thư viện bắt buộc truyền options: `new TikTokLiveConnection(user, {})` (không có `{}` sẽ crash).
- Dữ liệu là proto thô: user `id` / `displayId` / `nickname` / `avatarThumb.urlList`; chat `content`; like `count`; quà `gift.name` / `gift.diamondCount` (= giá coin) / `gift.type` / `gift.image.urlList`, `repeatCount`, `repeatEnd`.
- Avatar đến từ `p16/p19-common-sign.tiktokcdn.com`, proxy `/avatar` tải được (HTTP 200, webp).
- **Quà đã xác nhận với live thật:** `gift.diamondCount` = giá coin (Finger Heart 5, Rosa 10, Cap 99, Rose 1). Quà combo (`gift.type` = 1) gửi 1 sự kiện lúc bắt đầu (`repeatEnd: 0`) và 1 sự kiện lúc kết thúc (`repeatEnd: 1`, ~3–4 giây sau, cùng `groupId`). Server phát ngay ở sự kiện đầu rồi chỉ cộng phần thêm khi kết thúc; gửi kèm `comboPrev` / `comboTotal` để overlay kích hoạt 撒き餌 / 巨大魚の群れ khi tổng combo vượt ngưỡng (1 lần mỗi combo).
- **Giới hạn tần suất:** dịch vụ ký request của thư viện giới hạn số kết nối mỗi phút (`rate_limit_account_minute`). 1 server = 1 kết nối thì không sao; tránh mở nhiều kết nối cùng lúc khi test.

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
