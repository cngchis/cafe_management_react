# Các quyết định thiết kế

## Rà soát source

- Repository là ứng dụng client React 19 + TypeScript + Vite. `package.json` không có server, API client, ORM hoặc dependency cơ sở dữ liệu; không có migration hay schema cơ sở dữ liệu hiện hữu.
- Các route giao diện bao gồm tổng quan, POS, thực đơn, hóa đơn, khách hàng, sổ quỹ và cài đặt. Nội dung đến từ mảng mock trong các file và state của component React; không có lời gọi `fetch`/Axios hay lưu trữ phía trình duyệt.
- Dữ liệu sản phẩm có tên, nhóm món, giá, nhãn và hình ảnh. Giao diện thực đơn bổ sung SKU, giá vốn, tồn kho, loại thực đơn và mảng nguyên liệu; đồng thời cho phép chỉnh sửa các trường sản phẩm trong bộ nhớ.
- Ví dụ POS/giỏ hàng/hóa đơn thể hiện loại đơn, món hàng, số lượng, ảnh chụp phần/ghi chú, tiền hàng tạm tính, giảm giá, phí dịch vụ, tổng tiền, khách hàng, số khách, tên địa điểm hiển thị, thu ngân, mã hóa đơn/mã đơn, trạng thái và phương thức thanh toán.
- Dữ liệu khách hàng mẫu có tên, điện thoại, lượt đến, điểm, tổng chi tiêu và hạng thành viên. Lượt đến và tổng chi tiêu có thể tính từ đơn hàng đã lưu; source không có quy tắc tích điểm, đổi điểm hoặc nâng hạng.
- Sổ quỹ hỗ trợ giao dịch thu/chi, tài khoản tiền mặt/ngân hàng, số tiền, danh mục, nhãn bên liên quan, mã tham chiếu, ngày, mô tả và người tạo. Giao dịch thu bán hàng được mô tả là tự động liên kết với hóa đơn.
- Cài đặt cửa hàng có tên, số điện thoại, phần trăm phí dịch vụ và thông báo đơn hàng. Giao diện có nhãn địa điểm cố định trên hóa đơn, sổ quỹ và tồn kho món nhưng không có luồng quản trị nhiều địa điểm.

## Lựa chọn cơ sở dữ liệu

Đề xuất PostgreSQL 13+ cho schema quan hệ này. Đầu đơn bán hàng, ảnh chụp các dòng hàng, thanh toán, ghi sổ quỹ và điều chỉnh tồn kho cần khóa ngoại, ràng buộc và giao dịch. PostgreSQL hỗ trợ tạo UUID, chỉ mục từng phần, ràng buộc mạnh và cập nhật giao dịch trực tiếp. MySQL 8 cũng đáp ứng được, nhưng khi chọn MySQL cần chuyển đổi cách tạo UUID và chỉ mục từng phần; hiện không có ORM hay ràng buộc cơ sở dữ liệu nào buộc phải chọn một hệ quản trị cụ thể.

## Lựa chọn mô hình

- `store_settings` lưu cấu hình của một cửa hàng duy nhất và bị giới hạn bằng khóa chính cố định. `orders` đại diện cho cả đơn POS và hóa đơn. `receipt_code` và `order_number` giữ lại hai mã nhận diện hiển thị trên giao diện và duy nhất toàn cửa hàng; trạng thái và dấu thời gian lưu lịch sử vòng đời.
- Dòng hàng chụp lại tên, phần, ghi chú và giá để chỉnh sửa sản phẩm sau này không làm thay đổi hóa đơn lịch sử. Việc ngăn sửa đơn đã đóng vẫn là quy tắc quyền/giao dịch của ứng dụng. Lịch sử sản phẩm/khách hàng/kế toán hạn chế xóa khi phù hợp; tham chiếu sản phẩm trên dòng hàng cũ và tham chiếu khách hàng trên đơn có thể được xóa liên kết mà không mất ảnh chụp.
- Tiền dùng `bigint` với đơn vị đồng VND nguyên, phù hợp các giá trị hiển thị và tránh làm tròn số dấu phẩy động. Tỷ lệ phần trăm dùng `numeric(5,2)`. Tổng đơn có ràng buộc trên một dòng; tính tổng các dòng hàng, tổng thanh toán và ghi sổ quỹ phải diễn ra trong giao dịch cơ sở dữ liệu của ứng dụng.
- Thanh toán được tách thành các dòng riêng để giữ lịch sử và hỗ trợ thanh toán một phần/nhiều phương thức, dù màn hình hiện chỉ minh họa một lần thanh toán tiền mặt. Mỗi thanh toán có thể liên kết với tối đa một bút toán sổ quỹ; giao dịch sổ quỹ thủ công không có liên kết thanh toán.
- Tồn kho món được mô hình hóa thành sổ biến động cho cửa hàng duy nhất; cộng các lượng thay đổi có dấu theo sản phẩm để lấy tồn hiện tại. Cho phép tồn âm vì giao diện hiển thị `-2`. Cập nhật tồn kho nên thêm một bút toán trong cùng giao dịch với mọi sự kiện làm thay đổi số dư, và ứng dụng nên ngăn sửa/xóa lịch sử.
- `store_settings` lưu tên cửa hàng, số điện thoại, phí dịch vụ và cài đặt thông báo đang có trong biểu mẫu cài đặt. Tài khoản quỹ và tồn kho áp dụng trên toàn cửa hàng.
- Lượt đến và tổng chi tiêu của khách hàng nên được truy vấn từ đơn đã hoàn thành, tránh các bộ đếm tổng hợp bị lệch. Điểm và hạng được lưu vì dữ liệu mẫu có hiển thị nhưng source không có quy tắc thành viên.
- Số tiền sổ quỹ lưu dưới dạng giá trị dương; chiều thu/chi lưu riêng. Mỗi giao dịch liên kết trực tiếp với một tài khoản quỹ duy nhất của cửa hàng.

## Chủ ý loại trừ

- Không tạo danh mục nguyên liệu hoặc bảng công thức/BOM: giao diện chỉ hiển thị một mảng chuỗi luôn rỗng và không có thao tác sửa nguyên liệu, đơn vị, định lượng hay logic tiêu hao khi pha chế.
- Không có luồng mua nguyên liệu thô, nhà cung cấp, nhận hàng, điều chuyển hay hao hụt/chênh lệch: việc mua nguyên liệu chỉ xuất hiện như mô tả/danh mục sổ quỹ. Nó không liên kết với nghiệp vụ nhận hàng vào kho có cấu trúc, và source không ghi nhận hao hụt.
- Không có bảng người dùng/vai trò/xác thực: giao diện có tên thu ngân nhưng không có tài khoản/đăng nhập/phân quyền. Tên được lưu dưới dạng ảnh chụp cho đến khi có yêu cầu thật về nhân sự/xác thực.
- Không có tính thuế hay bảng thuế suất: chi tiết giá cho biết thuế đã nằm trong giá bán hiển thị, không có logic thuế cấu hình được.
- Không có bảng hóa đơn, bảng giá, phòng/bàn, khuyến mại, gửi thông báo hay sổ điểm thành viên riêng: các màn hình có nhãn hoặc phần giữ chỗ nhưng không có luồng hoặc quy tắc tương ứng.

## Giả định và câu hỏi còn mở

1. Mô hình hóa một cửa hàng duy nhất; mã hóa đơn/mã đơn/mã tham chiếu là duy nhất toàn cửa hàng và tồn kho/sổ quỹ dùng chung. Xác nhận có cần tách dữ liệu cho nhiều địa điểm trong tương lai không.
2. Xem mọi số tiền hiện tại là VND và số lượng là từng món bán. Xác nhận có cần đơn vị tồn kho lẻ, ngoại tệ hoặc locale khác không.
3. Xem đơn hoàn thành/đã hủy là đơn đã đóng và giữ lại; xác nhận hủy/hoàn tiền sau khi đóng có cần lý do chính thức và sổ bút toán đảo hay không.
4. Schema hỗ trợ trạng thái thanh toán và nhiều phương thức, nhưng giao diện không có thao tác thanh toán một phần/hoàn tiền. Xác nhận vòng đời thanh toán mong muốn trước khi triển khai ghi dữ liệu.
5. Source chưa có ranh giới lưu trữ/backend. Đề xuất này không triển khai API, cài đặt cơ sở dữ liệu, migration hay nhập dữ liệu. Cần thiết kế giao dịch ứng dụng và phân quyền khi chọn backend.
6. Dữ liệu mock hiện có chỗ không nhất quán (ví dụ tổng các dòng trên một hóa đơn mẫu có thể không khớp tổng hiển thị; ID và cài đặt mock không phải dữ liệu seed chuẩn). Không nạp các ví dụ đó làm dữ liệu production nếu chưa đối soát.
