import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 46 — hẹn lịch phỏng vấn: NTD đề xuất tối đa 3 khung giờ, ứng viên chọn 1; cờ đã nhắc trước 24h. Chỉ thêm cột.
export class AddInterviewScheduling1789961000000 implements MigrationInterface {
  name = 'AddInterviewScheduling1789961000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "interview_slots" jsonb`);
    await q.query(`ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "interview_at" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "interview_place" character varying(300)`);
    await q.query(`ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "interview_note" text`);
    await q.query(`ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "interview_reminded" boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const c of ['interview_reminded', 'interview_note', 'interview_place', 'interview_at', 'interview_slots'])
      await q.query(`ALTER TABLE "applications" DROP COLUMN IF EXISTS "${c}"`);
  }
}
