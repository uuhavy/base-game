// ==================== LOGIC TỰ ĐỘNG KẾT NỐI QUA BASE/FARCASTER SDK ====================
let userWalletAddress = null;
let username = null;

async function initBaseAppFrame() {
    // Kiểm tra xem SDK đã được tải thành công từ CDN chưa
    if (window.FrameSDK) {
        try {
            // Gọi lệnh thông báo cho Base App biết game đã sẵn sàng hiển thị bên trong ứng dụng
            window.FrameSDK.actions.ready();

            // Lấy thông tin ngữ cảnh (Context) trực tiếp từ tài khoản đang đăng nhập trên Base App
            const context = await window.FrameSDK.context;
            
            if (context && context.user) {
                // Tự động lấy địa chỉ ví kết nối với tài khoản Base App
                userWalletAddress = context.user.custodyAddress || context.user.verifiedAddresses?.[0];
                // Tự động lấy Username (nếu có)
                username = context.user.username || "Pilot";

                // Hiển thị thông tin Pilot lên HUD cực kỳ chuyên nghiệp mà không cần bấm nút Connect
                if (username) {
                    document.getElementById('wallet-display').innerText = `@${username}`;
                } else if (userWalletAddress) {
                    const shortAdd = userWalletAddress.substring(0, 6) + "..." + userWalletAddress.substring(userWalletAddress.length - 4);
                    document.getElementById('wallet-display').innerText = shortAdd;
                }
            } else {
                // Chế độ dự phòng nếu test ngoài trình duyệt thường không nằm trong Base App
                document.getElementById('wallet-display').innerText = "Guest Mode";
            }

            // SAU KHI NHẬN DIỆN XONG, TỰ ĐỘNG VÀO GAME LUÔN KHÔNG ĐỢI POPUP
            init();
            animate();

        } catch (sdkError) {
            console.error("Lỗi khi kết nối với SDK Base App:", sdkError);
            // Vẫn cho chơi game ở chế độ Guest nếu SDK lỗi
            document.getElementById('wallet-display').innerText = "Guest Mode";
            init();
            animate();
        }
    } else {
        // Nếu chơi trực tiếp trên trình duyệt web thường bên ngoài Base App
        document.getElementById('wallet-display').innerText = "Browser Mode";
        init();
        animate();
    }
}

// Chạy hàm kích hoạt ngay khi trang web được tải xong hoàn toàn
window.addEventListener('DOMContentLoaded', () => {
    initBaseAppFrame();
});