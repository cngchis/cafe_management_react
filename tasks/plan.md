# Kế hoạch: Nhân viên, lịch làm việc và bảng lương

## Phạm vi

Thêm ba mục trong **Nhiều hơn**: quản lý tài khoản nhân viên, xếp ca theo tuần, và tổng hợp lương tháng theo giờ làm trong ca đã xếp. Không thêm chấm công, phụ cấp, khấu trừ hoặc nghiệp vụ nguyên liệu.

## Quyết định

- Chỉ `owner` được quản lý tài khoản nhân viên, lịch và bảng lương.
- Nhân viên dùng các vai trò `manager` hoặc `cashier`; mật khẩu được băm Argon2 như luồng đăng nhập hiện tại.
- Lương tháng = đơn giá giờ × (thời lượng ca − phút nghỉ), làm tròn đến VND; không bao gồm thưởng/khấu trừ.
- Lịch ca và đơn giá lưu trong PostgreSQL; migration additive.
- Bảng tính tải về dưới dạng `.xlsx`.

## Các lát triển khai

1. **Nhân viên** — API owner-only, lưu đơn giá giờ, tạo/cập nhật/vô hiệu hóa tài khoản, giao diện quản lý.
2. **Lịch tuần** — API tạo/xóa ca, ngăn ca chồng lấn, giao diện tuần và biểu mẫu xếp ca.
3. **Bảng lương** — tổng hợp ca theo tháng, hiển thị số giờ và tiền lương, tải bảng Excel.

## Kiểm tra

- Build backend TypeScript và frontend sau mỗi lát.
- Kiểm tra thủ công API quyền truy cập và migration; không thay đổi dữ liệu tài khoản hiện có ngoài cột đơn giá mặc định 0.

## Chưa bao gồm

- Chấm công vào/ra, duyệt công, tăng ca, phụ cấp, khấu trừ và thanh toán lương.
