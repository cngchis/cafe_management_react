# Từ điển dữ liệu

Tất cả cột tiền tệ là số nguyên đồng Việt Nam (VND); không dùng số dấu phẩy động. Khóa chính UUID được PostgreSQL tạo. Dấu thời gian dùng `timestamptz` và mặc định theo thời gian cơ sở dữ liệu.

## `store_settings`

Cấu hình của một cửa hàng duy nhất. Ràng buộc singleton chỉ cho phép một dòng cấu hình.

| Cột | Kiểu dữ liệu | Ý nghĩa / quy tắc |
|---|---|---|
| `id` | `smallint` | Khóa chính cố định bằng 1 để bảo đảm chỉ có một dòng cấu hình. |
| `store_name` | `text` | Tên cửa hàng bắt buộc, không được để trống. |
| `phone` | `text` | Số điện thoại cửa hàng tùy chọn, lấy từ phần cài đặt. |
| `service_fee_percent` | `numeric(5,2)` | Phí dịch vụ mặc định của đơn hàng; từ 0 đến 100. |
| `order_notifications_enabled` | `boolean` | Cài đặt thông báo đơn hàng. |
| `created_at` | `timestamptz` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamptz` | Thời điểm cập nhật bản ghi; được duy trì trong mã ứng dụng. |

## `products`

Các mặt hàng trong danh mục thực đơn. Nhóm món và loại thực đơn giữ dạng văn bản vì giao diện cho nhập văn bản tự do và không có màn hình quản lý danh mục.

| Cột | Kiểu dữ liệu | Ý nghĩa / quy tắc |
|---|---|---|
| `id` | `uuid` | Khóa chính. |
| `sku` | `text` | Mã sản phẩm bắt buộc và duy nhất. |
| `name` | `text` | Tên hiển thị bắt buộc, không được để trống. |
| `category` | `text` | Nhóm món bắt buộc. |
| `menu_type` | `text` | Mặc định là `Món thường`. |
| `image_url` | `text` | URL hình ảnh sản phẩm, không bắt buộc. |
| `tag` | `text` | Nhãn tùy chọn trên thực đơn, ví dụ “Mới” hoặc “Bán chạy”. |
| `sale_price_vnd` | `bigint` | Giá bán hiện tại bằng VND, không âm. |
| `cost_price_vnd` | `bigint` | Giá vốn hiển thị do người dùng nhập, bằng VND và không âm. |
| `is_active` | `boolean` | Cho biết món có đang được bán hay không; nên ngừng kích hoạt thay vì xóa nếu đã có lịch sử tồn kho tham chiếu đến món. |
| `created_at` | `timestamptz` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamptz` | Thời điểm cập nhật bản ghi; được duy trì trong mã ứng dụng. |

## `customers`

Thông tin khách hàng/thành viên được hiển thị trong danh sách khách hàng và chi tiết đơn hàng.

| Cột | Kiểu dữ liệu | Ý nghĩa / quy tắc |
|---|---|---|
| `id` | `uuid` | Khóa chính. |
| `name` | `text` | Tên khách hàng bắt buộc, không được để trống. |
| `phone` | `text` | Số điện thoại tùy chọn; duy nhất nếu có giá trị. |
| `points_balance` | `integer` | Số dư điểm thành viên hiển thị, không âm. |
| `membership_tier` | `text` | Hạng thành viên hiển thị; source chưa triển khai quy tắc hạng. |
| `is_active` | `boolean` | Cho biết khách hàng còn hoạt động hay không. |
| `created_at` | `timestamptz` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamptz` | Thời điểm cập nhật bản ghi; được duy trì trong mã ứng dụng. |

## `orders`

Đầu phiếu bán hàng và hóa đơn. Màn hình hóa đơn được xem là một cách hiển thị giao dịch bán hàng, không phải một đối tượng nghiệp vụ riêng.

| Cột | Kiểu dữ liệu | Ý nghĩa / quy tắc |
|---|---|---|
| `id` | `uuid` | Khóa chính. |
| `customer_id` | `uuid` | Khóa ngoại tùy chọn đến `customers`; đặt thành null khi xóa khách hàng. |
| `receipt_code` | `text` | Mã hóa đơn/biên nhận, duy nhất trong cửa hàng. |
| `order_number` | `text` | Mã đơn POS, duy nhất trong cửa hàng. |
| `status` | `text` | `open`, `in_progress`, `awaiting_payment`, `completed` hoặc `cancelled`. |
| `order_type` | `text` | `dine_in`, `takeaway`, `delivery` hoặc `staff` (có trong hóa đơn mẫu). |
| `service_location` | `text` | Nhãn bàn/điểm nhận tùy chọn, dạng văn bản tự do. |
| `guest_count` | `integer` | Số khách dương, mặc định là một. |
| `cashier_name` | `text` | Ảnh chụp tên thu ngân tại thời điểm đó; source không có mô hình người dùng/xác thực. |
| `order_note` | `text` | Ghi chú đơn hàng tùy chọn. |
| `currency_code` | `char(3)` | Bị ràng buộc cố định là `VND`. |
| `subtotal_vnd` | `bigint` | Tổng các dòng hàng trước giảm giá, được tính trong giao dịch cơ sở dữ liệu. |
| `discount_vnd` | `bigint` | Giảm giá cấp đơn hàng; không được vượt quá tiền hàng tạm tính. |
| `service_fee_percent` | `numeric(5,2)` | Tỷ lệ phí dịch vụ được lưu lại từ cài đặt cửa hàng tại thời điểm tạo đơn. |
| `service_fee_vnd` | `bigint` | Số tiền phí dịch vụ được lưu lại tại thời điểm tạo đơn. |
| `tax_included` | `boolean` | Giao diện cho biết thuế đã bao gồm trong giá bán. |
| `total_vnd` | `bigint` | Phải bằng tiền hàng tạm tính − giảm giá + phí dịch vụ. |
| `ordered_at` | `timestamptz` | Thời điểm tạo đơn/nghiệp vụ. |
| `closed_at` | `timestamptz` | Bắt buộc chính xác khi đơn ở trạng thái hoàn thành hoặc đã hủy. |
| `created_at` | `timestamptz` | Thời điểm tạo bản ghi. |
| `updated_at` | `timestamptz` | Thời điểm cập nhật bản ghi; được duy trì trong mã ứng dụng. |

## `order_items`

Ảnh chụp các dòng hàng tại thời điểm bán, giữ lại thông tin đã bán và giá bán kể cả khi danh mục thay đổi sau đó. Bản thân schema không cấm cập nhật đơn đã đóng; ứng dụng nên thực thi quy tắc vòng đời đó.

| Cột | Kiểu dữ liệu | Ý nghĩa / quy tắc |
|---|---|---|
| `id` | `uuid` | Khóa chính. |
| `order_id` | `uuid` | Khóa ngoại bắt buộc đến `orders`; không cho xóa đơn khi còn dòng hàng tham chiếu. |
| `product_id` | `uuid` | Khóa ngoại tùy chọn đến `products`; đặt thành null nếu xóa món khỏi danh mục. |
| `product_name_snapshot` | `text` | Tên món tại thời điểm bán, bắt buộc. |
| `portion_snapshot` | `text` | Nhãn phần/size hiển thị trên hóa đơn. |
| `note` | `text` | Ghi chú pha chế/món. |
| `quantity` | `integer` | Số lượng bán dương. |
| `unit_price_vnd` | `bigint` | Đơn giá tại thời điểm bán. |
| `discount_vnd` | `bigint` | Giảm giá theo dòng hàng, mặc định bằng không. |
| `line_total_vnd` | `bigint` | Phải bằng số lượng × đơn giá − giảm giá dòng hàng. |
| `created_at` | `timestamptz` | Thời điểm tạo bản ghi. |

## `payments`

Lịch sử thanh toán của đơn hàng, được tách khỏi đơn để có thể lưu các lần thử thanh toán và nhiều phương thức thanh toán.

| Cột | Kiểu dữ liệu | Ý nghĩa / quy tắc |
|---|---|---|
| `id` | `uuid` | Khóa chính. |
| `order_id` | `uuid` | Khóa ngoại bắt buộc đến `orders`; không cho xóa đơn đang được tham chiếu. |
| `amount_vnd` | `bigint` | Số tiền thanh toán dương. |
| `method` | `text` | `cash`, `bank_transfer`, `card` hoặc `other`; giao diện hiện chỉ thể hiện tiền mặt. |
| `status` | `text` | `pending`, `completed`, `failed` hoặc `refunded`. |
| `external_reference` | `text` | Mã tham chiếu thanh toán bên ngoài, không bắt buộc. |
| `paid_at` | `timestamptz` | Thời điểm phát sinh thanh toán. |
| `created_at` | `timestamptz` | Thời điểm tạo bản ghi. |

## `cash_accounts`

Tài khoản tiền mặt hoặc ngân hàng được dùng cho các giao dịch sổ quỹ.

| Cột | Kiểu dữ liệu | Ý nghĩa / quy tắc |
|---|---|---|
| `id` | `uuid` | Khóa chính. |
| `name` | `text` | Tên tài khoản duy nhất trong cửa hàng. |
| `account_type` | `text` | `cash` hoặc `bank`. |
| `is_active` | `boolean` | Trạng thái hoạt động của tài khoản. |
| `created_at` | `timestamptz` | Thời điểm tạo bản ghi. |

## `cashbook_entries`

Các bút toán thu/chi lịch sử. Số thu và số chi lưu dưới dạng số dương; chiều giao dịch được lưu riêng.

| Cột | Kiểu dữ liệu | Ý nghĩa / quy tắc |
|---|---|---|
| `id` | `uuid` | Khóa chính. |
| `cash_account_id` | `uuid` | Khóa ngoại bắt buộc đến tài khoản quỹ. |
| `payment_id` | `uuid` | Khóa ngoại duy nhất, không bắt buộc, đến thanh toán; mỗi thanh toán được liên kết tối đa với một bút toán sổ quỹ. |
| `reference_code` | `text` | Mã tham chiếu bắt buộc, duy nhất trong cửa hàng. |
| `direction` | `text` | `in` hoặc `out`. |
| `title` | `text` | Lý do/tiêu đề bắt buộc, không được để trống. |
| `category` | `text` | Danh mục sổ quỹ bắt buộc, ví dụ thu bán hàng hoặc chi phí khác. |
| `counterparty_group` | `text` | Nhóm người nộp/người nhận tùy chọn. |
| `counterparty_name` | `text` | Tên người nộp/người nhận tùy chọn. |
| `description` | `text` | Chi tiết tùy chọn. |
| `amount_vnd` | `bigint` | Số tiền dương bằng VND. |
| `created_by_name` | `text` | Ảnh chụp tên thu ngân/người tạo. |
| `occurred_at` | `timestamptz` | Thời điểm nghiệp vụ phát sinh. |
| `created_at` | `timestamptz` | Thời điểm tạo bản ghi. |

## `inventory_movements`

Các thay đổi có dấu đối với tồn kho món bán của cửa hàng duy nhất. Cách ghi dự kiến là chỉ thêm mới; ứng dụng nên từ chối sửa/xóa. Tồn hiện tại được tính bằng `SUM(quantity_delta)` theo sản phẩm. Cho phép số dư âm để giữ hành vi đang hiển thị trong giao diện.

| Cột | Kiểu dữ liệu | Ý nghĩa / quy tắc |
|---|---|---|
| `id` | `uuid` | Khóa chính. |
| `product_id` | `uuid` | Khóa ngoại bắt buộc đến `products`. |
| `quantity_delta` | `numeric(14,3)` | Lượng thay đổi có dấu, khác không. |
| `reason` | `text` | `opening_balance`, `manual_adjustment` hoặc `correction`; không mã hóa luồng hao hụt/nhập mua chưa được triển khai. |
| `note` | `text` | Diễn giải điều chỉnh tùy chọn. |
| `created_by_name` | `text` | Ảnh chụp tên người thao tác. |
| `occurred_at` | `timestamptz` | Thời điểm thay đổi tồn kho phát sinh. |
| `created_at` | `timestamptz` | Thời điểm tạo bản ghi. |

## Tóm tắt toàn vẹn và chỉ mục

- Các mã định danh tự nhiên (SKU, mã đơn/biên nhận/mã tham chiếu trong cửa hàng, số điện thoại khách hàng nếu có) có ràng buộc/chỉ mục duy nhất.
- Khóa ngoại ngăn xóa lịch sử bán hàng/kế toán. Xóa sản phẩm vẫn giữ ảnh chụp trên dòng hóa đơn; xóa khách hàng đặt liên kết trong đơn thành null.
- Chỉ mục hỗ trợ tra cứu danh mục đang hoạt động/nhóm món, tra cứu khách hàng, lọc đơn theo ngày/trạng thái/khách hàng, tra cứu dòng đơn, lịch sử thanh toán, lịch sử sổ quỹ và lịch sử tồn kho theo món.
- Tổng hợp qua nhiều dòng (tổng tiền hàng của đơn, số dư thanh toán và tồn kho) cần logic giao dịch ở tầng ứng dụng; `CHECK` cấp dòng của SQL không thể xác thực tổng trên các dòng con.
