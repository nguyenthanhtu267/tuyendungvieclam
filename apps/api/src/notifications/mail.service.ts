import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as nodemailer from 'nodemailer';

// Đợt 48 — gửi EMAIL kèm thông báo quan trọng. TỰ TẮT khi chưa cấu hình SMTP (web vẫn chạy bình thường, chỉ báo ở chuông).
// Biến môi trường (Render → Environment):
//   SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, MAIL_FROM ("Tuyển Dụng Việc Làm <no-reply@...>"),
//   WEB_URL (https://tuyendungvieclam.vercel.app) để tạo đường dẫn trong email.
// Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=địa chỉ gmail, SMTP_PASS=App Password 16 ký tự.
export const EMAIL_TYPES = new Set([
  'job_alert_match',
  'job_digest',
  'job_invite',
  'interview_invite',
  'interview_confirmed',
  'interview_reminder',
  'application_status',
  'application_viewed',
  'application_reminder',
  'application_stale',
  'job_closing',
  'job_approved',
  'job_rejected',
]);
// Loại "tiếp thị việc làm" — chỉ gửi khi ứng viên bật "Nhận thông báo việc làm".
const OPT_IN_TYPES = new Set(['job_alert_match', 'job_digest']);

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from = '';
  private webUrl = '';

  constructor(@InjectDataSource() private readonly ds: DataSource) {
    const host = process.env.SMTP_HOST;
    if (!host) return;
    const port = Number(process.env.SMTP_PORT ?? 587);
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    this.from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? 'no-reply@localhost';
    this.webUrl = (process.env.WEB_URL ?? '').replace(/\/$/, '');
    this.log.log(`Gửi email BẬT qua ${host}:${port}`);
  }

  get enabled() {
    return !!this.transporter;
  }

  // Không chặn luồng chính; lỗi gửi chỉ ghi log.
  notify(userIds: string[], type: string, content: string, link?: string | null) {
    if (!this.transporter || !EMAIL_TYPES.has(type) || userIds.length === 0) return;
    this.send(userIds, type, content, link).catch((e) => this.log.warn(`Gửi email lỗi: ${e?.message ?? e}`));
  }

  private async send(userIds: string[], type: string, content: string, link?: string | null) {
    const rows: { id: string; email: string; allow: boolean | null }[] = await this.ds.query(
      `SELECT u.id, u.email, p.allow_job_notifications AS allow
         FROM users u LEFT JOIN candidate_profiles p ON p.user_id = u.id
        WHERE u.id::text = ANY($1::text[])`,
      [userIds],
    );
    const url = link && this.webUrl ? `${this.webUrl}${link.startsWith('/') ? '' : '/'}${link}` : this.webUrl || null;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    for (const r of rows) {
      // Bỏ qua địa chỉ không có thật (dữ liệu mẫu/khách) để không bị trả thư, giữ uy tín tên miền gửi.
      if (!r.email || /@(guest\.local|[^@]*-demo\.vn|example\.(com|org)|[^@]*\.(test|local|invalid))$/i.test(r.email)) continue;
      if (OPT_IN_TYPES.has(type) && r.allow === false) continue;
      await this.transporter!.sendMail({
        from: this.from,
        to: r.email,
        subject: content.length > 90 ? content.slice(0, 88) + '…' : content,
        text: `${content}\n\n${url ? `Xem chi tiết: ${url}\n\n` : ''}— Tuyển Dụng Việc Làm`,
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0A0E14;line-height:1.5">
<p>${esc(content)}</p>
${url ? `<p><a href="${esc(url)}" style="display:inline-block;background:#163B7A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Xem chi tiết</a></p>` : ''}
<p style="color:#3D4654;font-size:13px">— Tuyển Dụng Việc Làm. Bạn nhận email này vì có tài khoản trên website; tắt "Nhận thông báo việc làm" trong Hồ sơ → Cài đặt để ngừng nhận gợi ý việc làm.</p></div>`,
      });
    }
  }
}
