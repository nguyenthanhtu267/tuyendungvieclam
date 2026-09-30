import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminSetting } from '../database/entities/admin-setting.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { BgImage } from '../database/entities/bg-image.entity';
import { AdminActor, logAdminAction } from '../admin-tools/admin-audit';
import { FileStorageService } from '../storage/file-storage.service';
import { BG_IMAGE_THEME_PREFIX, BG_THEME_IDS } from '../admin/bg-themes';

const SETTING_ID = 'singleton';
const MAX_IMAGES = 30;
const MAX_BYTES = 4 * 1024 * 1024;
const MIMES = ['image/webp', 'image/jpeg', 'image/png'];

export interface BgImageView {
  id: string;
  name: string;
  overlay: number;
  width: number;
  height: number;
  url: string;
}
export interface BgSettingView {
  mode: 'fixed' | 'auto' | 'none';
  theme: string;
  autoThemes: string[];
  hours: number;
  images: BgImageView[];
}

// Đợt 30b (30/09/2026) — nền giao diện: mẫu vector + ảnh do Admin tải lên; cố định / tự động / tắt nền.
@Injectable()
export class BackgroundService {
  constructor(
    @InjectRepository(AdminSetting)
    private readonly settingRepo: Repository<AdminSetting>,
    @InjectRepository(BgImage) private readonly imgRepo: Repository<BgImage>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
    private readonly storage: FileStorageService,
  ) {}

  private async setting(): Promise<AdminSetting> {
    let s = await this.settingRepo.findOne({ where: { id: SETTING_ID } });
    if (!s)
      s = await this.settingRepo.save(
        this.settingRepo.create({ id: SETTING_ID }),
      );
    return s;
  }

  private view(i: BgImage): BgImageView {
    return {
      id: i.id,
      name: i.name,
      overlay: i.overlay,
      width: i.width,
      height: i.height,
      url: `/public/settings/background/image/${i.id}?v=${new Date(i.updatedAt).getTime()}`,
    };
  }

  private async images(): Promise<BgImage[]> {
    return this.imgRepo.find({ order: { createdAt: 'ASC' } });
  }

  async get(): Promise<BgSettingView> {
    const s = await this.setting();
    const imgs = await this.images();
    const ids = new Set([
      ...BG_THEME_IDS,
      ...imgs.map((i) => BG_IMAGE_THEME_PREFIX + i.id),
    ]);
    const mode =
      s.bgMode === 'fixed' || (s.bgMode as string) === 'none'
        ? (s.bgMode as 'fixed' | 'none')
        : 'auto';
    return {
      mode,
      theme: ids.has(s.bgTheme) ? s.bgTheme : 'neural-1',
      autoThemes: (Array.isArray(s.bgAutoThemes) ? s.bgAutoThemes : []).filter(
        (x) => ids.has(x),
      ),
      hours: s.bgAutoHours || 2,
      images: imgs.map((i) => this.view(i)),
    };
  }

  async set(
    admin: AdminActor,
    dto: {
      mode: 'fixed' | 'auto' | 'none';
      theme: string;
      autoThemes: string[];
      hours: number;
    },
  ) {
    const imgs = await this.images();
    const ok = new Set([
      ...BG_THEME_IDS,
      ...imgs.map((i) => BG_IMAGE_THEME_PREFIX + i.id),
    ]);
    if (!ok.has(dto.theme))
      throw new BadRequestException(
        'Mẫu nền không hợp lệ (ảnh có thể đã bị xoá) — hãy tải lại trang',
      );
    const list = Array.from(new Set(dto.autoThemes));
    if (list.some((x) => !ok.has(x)))
      throw new BadRequestException(
        'Danh sách mẫu tự động có mẫu không hợp lệ — hãy tải lại trang',
      );
    const s = await this.setting();
    s.bgMode = dto.mode as AdminSetting['bgMode'];
    s.bgTheme = dto.theme;
    s.bgAutoThemes = list;
    s.bgAutoHours = dto.hours;
    await this.settingRepo.save(s);
    await logAdminAction(
      this.auditRepo,
      admin,
      'settings.background',
      'admin_setting',
      SETTING_ID,
      dto.mode === 'none'
        ? 'Nền giao diện: TẮT nền (nền trơn)'
        : dto.mode === 'fixed'
          ? `Nền giao diện: cố định "${dto.theme}"`
          : `Nền giao diện: tự động đổi mỗi ${dto.hours} giờ (${list.length || BG_THEME_IDS.length} mẫu)`,
    );
    return this.get();
  }

  async addImage(
    admin: AdminActor,
    file: Express.Multer.File | undefined,
    body: { name?: string; overlay?: string; width?: string; height?: string },
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh');
    if (!MIMES.includes(file.mimetype))
      throw new BadRequestException(
        'Ảnh phải là WEBP, JPG hoặc PNG (trang Admin tự đổi các đuôi khác sang WEBP)',
      );
    if (file.size > MAX_BYTES)
      throw new BadRequestException(
        'Ảnh sau khi nén vẫn quá 4MB — hãy chọn ảnh nhỏ hơn',
      );
    if ((await this.imgRepo.count()) >= MAX_IMAGES)
      throw new BadRequestException(
        `Tối đa ${MAX_IMAGES} ảnh nền — hãy xoá bớt ảnh cũ`,
      );
    const name = (body.name || 'Ảnh nền').trim().slice(0, 120) || 'Ảnh nền';
    const key = await this.storage.put(file.buffer, {
      name: `nen-${name}`,
      mime: file.mimetype,
      category: 'ad',
    });
    const overlay = Math.min(
      90,
      Math.max(0, body.overlay ? parseInt(body.overlay, 10) : 78),
    );
    const saved = await this.imgRepo.save(
      this.imgRepo.create({
        name,
        mime: file.mimetype,
        data: key ? null : file.buffer,
        storageKey: key,
        overlay,
        width: body.width ? parseInt(body.width, 10) : 0,
        height: body.height ? parseInt(body.height, 10) : 0,
        bytes: file.size,
      }),
    );
    await logAdminAction(
      this.auditRepo,
      admin,
      'settings.background_image_add',
      'bg_image',
      saved.id,
      name,
    );
    return this.view(saved);
  }

  async updateImage(
    admin: AdminActor,
    id: string,
    dto: { overlay?: number; name?: string },
  ) {
    const i = await this.imgRepo.findOne({ where: { id } });
    if (!i) throw new NotFoundException('Không tìm thấy ảnh nền');
    if (dto.overlay !== undefined) i.overlay = dto.overlay;
    if (dto.name !== undefined && dto.name.trim()) i.name = dto.name.trim();
    const saved = await this.imgRepo.save(i);
    await logAdminAction(
      this.auditRepo,
      admin,
      'settings.background_image_edit',
      'bg_image',
      id,
      saved.name,
    );
    return this.view(saved);
  }

  // Xoá ảnh; nếu ảnh đang được chọn thì tự trả về mẫu mặc định / bỏ khỏi vòng xoay (không để web trỏ vào ảnh đã mất).
  async removeImage(admin: AdminActor, id: string) {
    const i = await this.imgRepo.findOne({ where: { id } });
    if (!i) throw new NotFoundException('Không tìm thấy ảnh nền');
    await this.imgRepo.delete({ id });
    const s = await this.setting();
    const tid = BG_IMAGE_THEME_PREFIX + id;
    if (s.bgTheme === tid) s.bgTheme = 'neural-1';
    s.bgAutoThemes = (s.bgAutoThemes ?? []).filter((x) => x !== tid);
    await this.settingRepo.save(s);
    await logAdminAction(
      this.auditRepo,
      admin,
      'settings.background_image_remove',
      'bg_image',
      id,
      i.name,
    );
    return this.get();
  }

  async imageData(id: string): Promise<{ data: Buffer; mime: string } | null> {
    const i = await this.imgRepo
      .createQueryBuilder('i')
      .addSelect('i.data')
      .where('i.id = :id', { id })
      .getOne();
    if (!i) return null;
    const data = await this.storage.resolve(i.data, i.storageKey);
    return data ? { data, mime: i.mime } : null;
  }
}
