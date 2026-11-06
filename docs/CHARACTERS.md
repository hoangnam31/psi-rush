# Hệ thống nhân vật PSI Rush

## Kiến trúc

PSI Rush vẫn dùng engine 2D Canvas và hệ thống vật lý tùy biến sẵn có trong `components/RaceGame.tsx`. Tám nhân vật dùng chung một player controller, cùng hitbox tròn và cùng logic map, checkpoint, vực, va chạm và respawn. `data/character_manifest.json` là nguồn dữ liệu duy nhất cho tên, vai trò và chỉ số; `lib/characters.ts` chuẩn hóa dữ liệu để Canvas, lobby, admin và bảng kết quả dùng chung.

Mỗi người chơi lưu `characterId` trong PostgreSQL. Trường `color` cũ được giữ để tương thích dữ liệu và dùng làm màu hiệu ứng, nhưng giao diện không còn cho đổi màu.

## Điều khiển và trạng thái

- Bàn phím: WASD/phím mũi tên để di chuyển, Space để nhảy, Shift để dash, E dành cho tương tác map.
- Gamepad: stick trái để di chuyển, A để nhảy, B/RB để dash, X dành cho tương tác map.
- Mobile: joystick, nút nhảy và boost hiện có tiếp tục dùng cùng controller.
- Trạng thái hình ảnh: idle, locomotion, jump, fall, land, dash, hit và respawn.

`baseSpeed`, `jumpImpulse` và `mass` được chuẩn hóa quanh Corgi Scout. Khối lượng ảnh hưởng lực bật do va chạm; hitbox không thay đổi theo hình để bảo đảm công bằng và không phá collision map.

## Asset hiện tại và pipeline nâng cấp

Các PNG gốc được import là concept render có nền, không phải model rigged hay spritesheet. Game dùng các bản cutout RGBA trong suốt mang hậu tố `_cutout.png` và tạo animation idle/run/jump/fall/land/dash/hit/respawn bằng transform Canvas/CSS, không còn khung ảnh. Khi có spritesheet hoặc model rigged thật, giữ nguyên `id`, mở rộng manifest bằng frame/state và thay phần render trong `drawMascot`; vật lý và dữ liệu phòng không cần thay đổi.

## Kiểm tra

```bash
npm run test:characters
npx tsc --noEmit
npm run lint
npm run build
```

Kiểm tra thủ công tối thiểu: đổi đủ 8 nhân vật trước khi join; thử bàn phím, gamepad và mobile; nhảy/dash/va vào vật cản và người khác; rơi vực để xác nhận camera, animation và respawn; kiểm tra cùng nhân vật ở lobby, gameplay, admin và podium.
