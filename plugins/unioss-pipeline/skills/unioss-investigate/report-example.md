# #391 Report

### 1. Mục tiêu:

Điều tra xem có thể xóa các cột `products.price`, `products.price_without_tax`, `products.tax_price` hay không, và sửa code nếu cần.

### 2. Kết quả điều tra:

- `products.price`: Đang sử dụng để hiển thị dự phòng cho giá sản phẩm nếu chưa có giá trên service type `product_service_type_maps.price` -> cập nhật hoàn toàn sang `product_service_type_maps.price`.
- `products.price_without_tax`: Không sử dụng.
- `products.tax_price`: Không sử dụng.
- Giá hiển thị đã ưu tiên dùng `product_service_type_maps.price` nên **không thay đổi** sau khi sửa.

### 3. Phạm vi ảnh hưởng:

**Tính năng**

- Top (トップページ / 自販機商品一覧)
- Product Detail (商品詳細)
- Cart List (カート一覧)
- Order Confirmation (注文確認)
- Order Complete (注文完了)
- Member Registration (会員登録)

**URLs**

- `/`
- `/products/detail/:id`
- `/cart`
- `/order/confirm`
- `/order/complete`
- `/regist/t_confirm`

### 4. Kết luận:

- Phạm vi ảnh hưởng **không quá lớn**.
- Sau khi cập nhật logic đang sử dụng -> **có thể xóa** các cột trong DB.
