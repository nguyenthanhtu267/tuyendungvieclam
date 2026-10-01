import { MigrationInterface, QueryRunner } from 'typeorm';

// Đợt 78 — câu hỏi sàng lọc khi ứng tuyển.
export class AddScreeningQuestions1789968000000 implements MigrationInterface {
  name = 'AddScreeningQuestions1789968000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "screening_questions" jsonb`);
    await q.query(`ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "screening_answers" jsonb`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "applications" DROP COLUMN IF EXISTS "screening_answers"`);
    await q.query(`ALTER TABLE "job_postings" DROP COLUMN IF EXISTS "screening_questions"`);
  }
}
