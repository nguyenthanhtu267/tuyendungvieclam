'use client';

// Đợt 90 — lưới an toàn cuối cùng (lỗi ở chính bố cục chung): vẫn hiện trang có nút tải lại thay vì màn hình trắng.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#F6F8FC', color: '#0F172A', margin: 0 }}>
        <main style={{ maxWidth: 520, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20 }}>Trang gặp sự cố tạm thời</h1>
          <p style={{ color: '#475569', fontSize: 14 }}>Vui lòng thử lại sau ít giây.</p>
          <button type="button" onClick={reset} style={{ background: '#163B7A', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
