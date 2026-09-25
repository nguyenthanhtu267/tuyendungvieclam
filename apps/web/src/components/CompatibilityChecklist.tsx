import type { CompatibilityChecklistItem } from '@/lib/api';

// Đợt 13 (24/09/2026) — "TIÊU CHÍ ĐÁNH GIÁ" dạng checklist chia nhóm, theo đúng mẫu careerviet.vn
// mà người dùng gửi ảnh (TỔNG QUAN / KINH NGHIỆM / BẰNG CẤP / KỸ NĂNG / KỸ NĂNG BẠN CÒN THIẾU).
// Bổ sung cho <CompatibilityRadar /> đã có từ Đợt 12ab — người dùng chọn giữ cả 2 dạng hiện song
// song trong sidebar trang chi tiết tin, không thay thế cái nào.
const GROUP_LABEL: Record<CompatibilityChecklistItem['group'], string> = {
  overview: 'Tổng quan',
  experience: 'Kinh nghiệm',
  education: 'Bằng cấp',
  skills: 'Kỹ năng',
};

const GROUP_ORDER: CompatibilityChecklistItem['group'][] = ['overview', 'experience', 'education', 'skills'];

export function CompatibilityChecklist({
  checklist,
  missingSkills,
}: {
  checklist: CompatibilityChecklistItem[];
  missingSkills: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {GROUP_ORDER.map((group) => {
        const items = checklist.filter((c) => c.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <div className="text-[10px] font-bold text-ink-faint uppercase tracking-wide mb-1.5">
              {GROUP_LABEL[group]}
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map((item) => (
                <div key={item.key} className="flex items-start gap-2 text-[12px]">
                  <span
                    className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                      item.matched ? 'bg-success text-white' : 'border border-border-strong'
                    }`}
                  >
                    {item.matched ? '✓' : ''}
                  </span>
                  <span className="text-ink-muted">
                    {item.label !== item.detail && <span className="text-ink-faint">{item.label}: </span>}
                    {item.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div>
        <div className="text-[10px] font-bold text-ink-faint uppercase tracking-wide mb-1.5">
          Kỹ năng bạn còn thiếu
        </div>
        {missingSkills.length === 0 ? (
          <div className="text-[11.5px] text-ink-faint">Không có — hồ sơ đã đủ kỹ năng tin yêu cầu.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {missingSkills.map((s) => (
              <span key={s} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-warning-tint text-warning">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
