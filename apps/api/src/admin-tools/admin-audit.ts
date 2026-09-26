import { Repository } from 'typeorm';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';

// Đợt 18 (26/09/2026) — ghi "Nhật ký thao tác" cho các chức năng Admin mới (giống hệt
// AdminService.logAction(), tách ra hàm dùng chung để module admin-tools không phụ thuộc AdminService).
export type AdminActor = { userId: string; email: string; role?: string };

// Cột admin_user_id trên CSDL thật là uuid (theo migration) → dùng uuid rỗng cho thao tác tự động.
export const SYSTEM_ACTOR: AdminActor = {
  userId: '00000000-0000-0000-0000-000000000000',
  email: 'he-thong (tu dong)',
};

export async function logAdminAction(
  repo: Repository<AdminAuditLog>,
  admin: AdminActor,
  action: string,
  targetType: string,
  targetId?: string,
  description?: string,
) {
  await repo.save(
    repo.create({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action,
      targetType,
      targetId,
      description: description?.slice(0, 500),
    }),
  );
}
