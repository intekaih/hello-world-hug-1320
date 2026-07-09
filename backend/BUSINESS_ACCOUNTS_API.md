# Business Accounts API

API này dùng để bên thứ ba, ví dụ Telegram bot bán tài khoản, tạo và quản lý tài khoản movieCC.

Base path:

```text
/api/business/accounts
```

## 1. Cấu hình

Trong `server/.env`, thêm API key riêng cho kênh bán tài khoản:

```env
BUSINESS_API_KEY=doi-mot-key-dai-ngau-nhien
```

Khởi động lại server sau khi đổi `.env`.

## 2. Xác thực

Mỗi request phải gửi một trong hai kiểu header sau:

```http
x-business-api-key: doi-mot-key-dai-ngau-nhien
```

Hoặc:

```http
Authorization: Bearer doi-mot-key-dai-ngau-nhien
```

Có thể gửi thêm tên client để log dễ truy vết:

```http
x-business-client: telegram-bot
```

Nếu thiếu hoặc sai key, API trả `401`.

## 3. Quy ước tài khoản

API này chỉ quản lý tài khoản do chính API tạo ra:

```json
{
  "account_source": "business_api",
  "role": "user"
}
```

API không cho khóa, gia hạn hoặc xóa tài khoản admin hay tài khoản tạo thủ công.

Trạng thái trả về trong field `status`:

```text
active   Tài khoản đang dùng được
locked   Tài khoản bị khóa
expired  Tài khoản hết hạn
```

Khi tài khoản hết hạn, login sẽ bị từ chối giống như tài khoản bị khóa.

## 4. Tạo tài khoản

```http
POST /api/business/accounts
```

Body:

```json
{
  "username": "moviecc_001",
  "password": "abc123456",
  "display_name": "moviecc_001",
  "durationDays": 30,
  "durationHours": 0,
  "externalRef": "telegram-order-123",
  "plan": "30d"
}
```

Các field:

```text
username      Bắt buộc, 3-50 ký tự, chỉ gồm chữ, số, dấu gạch dưới
password      Bắt buộc, tối thiểu 6 ký tự
display_name  Không bắt buộc, nếu bỏ trống sẽ dùng username
durationDays  Số ngày sử dụng
durationHours Số giờ sử dụng
expiresAt     Thời điểm hết hạn ISO 8601, dùng thay durationDays/durationHours
externalRef   Mã đơn hàng hoặc mã user Telegram để đối soát
plan          Tên gói, ví dụ 7d, 30d, 90d
```

Chỉ dùng một trong hai kiểu thời hạn:

```json
{ "durationDays": 30 }
```

Hoặc:

```json
{ "expiresAt": "2026-06-21T00:00:00.000Z" }
```

Response `201`:

```json
{
  "success": true,
  "user": {
    "id": "665f1f...",
    "username": "moviecc_001",
    "display_name": "moviecc_001",
    "role": "user",
    "is_active": true,
    "expires_at": "2026-06-21T11:00:00.000Z",
    "account_source": "business_api",
    "external_ref": "telegram-order-123",
    "plan": "30d",
    "status": "active"
  }
}
```

API không trả password trong response. Bot nên tự sinh password, lưu ở hệ thống bán hàng và gửi cho khách một lần.

Ví dụ curl:

```bash
curl -X POST "https://your-domain.com/api/business/accounts" \
  -H "Content-Type: application/json" \
  -H "x-business-api-key: doi-mot-key-dai-ngau-nhien" \
  -H "x-business-client: telegram-bot" \
  -d '{
    "username": "moviecc_001",
    "password": "abc123456",
    "durationDays": 30,
    "externalRef": "telegram-order-123",
    "plan": "30d"
  }'
```

## 5. Xem danh sách tài khoản

```http
GET /api/business/accounts
```

Query hỗ trợ:

```text
page    Trang, mặc định 1
limit   Số dòng mỗi trang, tối đa 100, mặc định 20
q       Tìm theo username, display_name, external_ref
status  active, locked hoặc expired
```

Ví dụ:

```bash
curl "https://your-domain.com/api/business/accounts?status=active&page=1&limit=20" \
  -H "x-business-api-key: doi-mot-key-dai-ngau-nhien"
```

Response:

```json
{
  "success": true,
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20,
  "totalPages": 0
}
```

## 6. Xem chi tiết tài khoản

```http
GET /api/business/accounts/:id-or-username
```

Ví dụ:

```bash
curl "https://your-domain.com/api/business/accounts/moviecc_001" \
  -H "x-business-api-key: doi-mot-key-dai-ngau-nhien"
```

## 7. Khóa tài khoản

```http
PATCH /api/business/accounts/:id-or-username/lock
```

Body:

```json
{
  "reason": "payment_refunded"
}
```

Ví dụ:

```bash
curl -X PATCH "https://your-domain.com/api/business/accounts/moviecc_001/lock" \
  -H "Content-Type: application/json" \
  -H "x-business-api-key: doi-mot-key-dai-ngau-nhien" \
  -d '{ "reason": "payment_refunded" }'
```

## 8. Mở khóa tài khoản

```http
PATCH /api/business/accounts/:id-or-username/unlock
```

Ví dụ:

```bash
curl -X PATCH "https://your-domain.com/api/business/accounts/moviecc_001/unlock" \
  -H "x-business-api-key: doi-mot-key-dai-ngau-nhien"
```

## 9. Gia hạn tài khoản

```http
PATCH /api/business/accounts/:id-or-username/renew
```

Body:

```json
{
  "durationDays": 30,
  "plan": "30d-renew"
}
```

Nếu tài khoản còn hạn, thời gian mới được cộng tiếp từ hạn cũ. Nếu đã hết hạn, thời gian mới được tính từ hiện tại.

Ví dụ:

```bash
curl -X PATCH "https://your-domain.com/api/business/accounts/moviecc_001/renew" \
  -H "Content-Type: application/json" \
  -H "x-business-api-key: doi-mot-key-dai-ngau-nhien" \
  -d '{ "durationDays": 30, "plan": "30d-renew" }'
```

## 10. Xóa tài khoản

```http
DELETE /api/business/accounts/:id-or-username
```

Lệnh này xóa tài khoản business và dữ liệu liên quan như lịch sử xem, yêu thích, watchlist, thông báo.

Ví dụ:

```bash
curl -X DELETE "https://your-domain.com/api/business/accounts/moviecc_001" \
  -H "x-business-api-key: doi-mot-key-dai-ngau-nhien"
```

Response:

```json
{
  "success": true,
  "deleted": {
    "id": "665f1f...",
    "username": "moviecc_001"
  }
}
```

## 11. Mã lỗi thường gặp

```text
400  Body không hợp lệ, thiếu username/password/thời hạn
401  Thiếu hoặc sai API key
404  Không tìm thấy tài khoản business
409  Username đã tồn tại
429  Gửi quá nhiều request
500  Lỗi máy chủ
```

Response lỗi:

```json
{
  "success": false,
  "message": "Ten dang nhap da ton tai"
}
```

## 12. Gợi ý tích hợp Telegram bot

Luồng bán account cơ bản:

```text
1. Khách thanh toán thành công
2. Bot sinh username/password
3. Bot gọi POST /api/business/accounts với durationDays theo gói
4. Bot gửi username/password và hạn dùng cho khách
5. Khi khách gia hạn, bot gọi PATCH /renew
6. Khi refund/vi phạm, bot gọi PATCH /lock
```

Nên lưu `externalRef` bằng mã đơn hàng hoặc Telegram user id để đối soát khi cần hỗ trợ khách.
