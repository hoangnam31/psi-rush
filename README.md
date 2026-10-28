# Wobble Rush

Game đua vượt chướng ngại vật chạy trực tiếp trên trình duyệt.

## Chạy local

```bash
python3 -m http.server 8080 --directory dist
```

Mở `http://localhost:8080`.

## Điều khiển

- WASD / phím mũi tên: di chuyển
- Space: nhảy
- Shift: tăng tốc
- Mobile: joystick, nút nhảy và boost

## Multiplayer

Bản demo triển khai dùng AI để mô phỏng phòng 20–200 tay đua và giữ toàn bộ gameplay chạy được ngay trên static hosting. Client có sẵn điểm nối WebSocket qua khóa `localStorage.wobble_server`.

Để vận hành 200 người thật trong một phòng, backend production nên dùng authoritative game loop, room sharding, snapshot interpolation và WebSocket gateway. Tần suất hợp lý: server tick 20 Hz, client render 60 FPS, snapshot delta 10–15 Hz. Không tin vị trí do client gửi lên; server chỉ nhận input và tự tính trạng thái.
