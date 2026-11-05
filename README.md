# PSI RUSH

Game party multiplayer chạy trên trình duyệt, có phòng riêng, mã QR tham gia, màn hình host/admin, nhiều round và 5 loại map. Nhánh `vercel` dùng Next.js 16 và PostgreSQL để triển khai trên Vercel.

Game có 8 mascot có thể chọn, dùng chung controller Canvas cho di chuyển, nhảy, dash, va chạm và respawn. Chi tiết kiến trúc và pipeline asset nằm trong [docs/CHARACTERS.md](docs/CHARACTERS.md).

## Chạy local

Yêu cầu Node.js 22 và một database PostgreSQL (khuyến nghị Neon).

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

Điền `DATABASE_URL` thật trong `.env.local`, sau đó mở `http://localhost:3000`.

## Triển khai Vercel

1. Import repository `hoangnam31/psi-rush` vào Vercel và chọn branch `vercel`.
2. Trong Vercel Marketplace, thêm Neon Postgres vào project. Neon sẽ cấp `DATABASE_URL`.
3. Thêm biến `PSI_RUSH_SITE_ENABLED=true` cho Production, Preview và Development.
4. Chạy migration một lần từ máy local với đúng `DATABASE_URL` production:

   ```bash
   npm run db:migrate
   ```

5. Deploy project. Vercel tự nhận diện Next.js; không cần cấu hình Build Command hay Output Directory riêng.

Để tạm đóng game, đổi `PSI_RUSH_SITE_ENABLED=false` trong Vercel rồi redeploy. Tất cả trang và API sẽ trả màn hình bảo trì/HTTP 503.

## Biến môi trường

| Tên | Bắt buộc | Mô tả |
| --- | --- | --- |
| `DATABASE_URL` | Có | Chuỗi kết nối PostgreSQL/Neon, chỉ dùng phía server |
| `PSI_RUSH_SITE_ENABLED` | Không | `true` để mở; `false`, `off`, `0` hoặc `disabled` để đóng |

Không commit `.env.local` hoặc chuỗi kết nối database vào GitHub.

## Các lệnh chính

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Chạy production build
npm run lint         # ESLint
npm run test:characters # Kiểm tra manifest và 8 asset nhân vật
npm run db:generate  # Tạo migration khi schema thay đổi
npm run db:migrate   # Áp migration lên PostgreSQL
```

Migration PostgreSQL nằm trong `drizzle-vercel/`. Thư mục `drizzle/` là migration D1 cũ của nhánh Sites và không được dùng trong bản Vercel.

## Lưu ý tải 200 người

Giao diện cho phép tối đa 200 người/phòng. Bản hiện tại đồng bộ trạng thái bằng HTTP polling và PostgreSQL. Trước một sự kiện thực tế 200 thiết bị, cần load-test trên đúng gói Vercel/Neon; nếu cần tần suất vị trí cao hơn, nên chuyển luồng vị trí realtime sang WebSocket/Redis chuyên dụng thay vì tăng polling vào Postgres.
