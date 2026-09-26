'use client';

import { useState } from 'react';
import {
  cvParseApi,
  ApiError,
  type CandidateDraft,
  type CvParseResult,
  type DraftEducation,
  type DraftExperience,
} from '@/lib/api';
import { PROVINCES } from '@/lib/catalogs';

// Đợt 18b/18c/18d (26/09/2026) — form dùng CHUNG cho:
//  - NTD "＋ Thêm CV" vào Kho CV (CV lấy từ email, Zalo, Facebook, file…)
//  - Admin "Tạo hồ sơ nguồn tổng hợp" và "Xem lại trước khi chia sẻ" CV trong hàng chờ
// Bước 1 — chọn nguồn: dán nội dung / tải file CV (PDF, DOCX) / dán link / nhập tay. Hệ thống tự tách
// thông tin theo quy tắc (họ tên, SĐT, email, kinh nghiệm, học vấn, kỹ năng…).
// Bước 2 — xem lại & sửa mọi trường; toàn văn CV luôn được giữ nguyên để tìm kiếm lại (không sót nội dung).

type SourceTab = 'text' | 'file' | 'url' | 'manual';

const LANGUAGE_LEVELS: { value: string; label: string }[] = [
  { value: 'native', label: 'Bản ngữ' },
  { value: 'excellent', label: 'Thành thạo' },
  { value: 'good', label: 'Tốt' },
  { value: 'fair', label: 'Khá' },
  { value: 'beginner', label: 'Cơ bản' },
];

const EMPTY_DRAFT: CandidateDraft = {
  fullName: '',
  experiences: [],
  educations: [],
  skills: [],
  languages: [],
  certificates: [],
};

export interface CandidateDraftFormProps {
  token: string;
  // Bản nháp có sẵn (VD Admin xem lại CV trong hàng chờ) → bỏ qua bước 1.
  initialDraft?: CandidateDraft | null;
  // Chức danh bắt buộc khi tạo hồ sơ tìm kiếm được (Admin); NTD nhập vào kho thì không bắt buộc.
  requireTitle?: boolean;
  submitLabel: string;
  // Khối bổ sung phía trên nút lưu (VD NTD chọn tin tuyển dụng để gắn CV).
  extra?: React.ReactNode;
  // Cho phép đính kèm file CV gốc khi lưu (mặc định có).
  allowAttachFile?: boolean;
  sourceHint?: string;
  onSubmit: (draft: CandidateDraft, file: File | null) => Promise<void>;
  onCancel?: () => void;
}

export function CandidateDraftForm({
  token,
  initialDraft,
  requireTitle,
  submitLabel,
  extra,
  allowAttachFile = true,
  sourceHint,
  onSubmit,
  onCancel,
}: CandidateDraftFormProps) {
  const [step, setStep] = useState<'source' | 'review'>(initialDraft ? 'review' : 'source');
  const [tab, setTab] = useState<SourceTab>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CandidateDraft>(normalizeDraft(initialDraft ?? EMPTY_DRAFT));
  const [skillsText, setSkillsText] = useState((initialDraft?.skills ?? []).join(', '));
  const [certsText, setCertsText] = useState((initialDraft?.certificates ?? []).join('\n'));
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  function applyParse(res: CvParseResult) {
    const d = normalizeDraft({ ...EMPTY_DRAFT, ...res.draft, fullName: res.draft.fullName ?? '' } as CandidateDraft);
    setDraft(d);
    setSkillsText((d.skills ?? []).join(', '));
    setCertsText((d.certificates ?? []).join('\n'));
    const found = countFound(d);
    setNotice(
      res.warning
        ? res.warning
        : found > 0
          ? `Đã tự tách ${found} nhóm thông tin — vui lòng kiểm tra lại, sửa chỗ chưa đúng rồi lưu.`
          : 'Chưa tách được thông tin nào tự động — vui lòng nhập tay các trường bên dưới.',
    );
    setStep('review');
  }

  async function handleParse() {
    setError(null);
    setNotice(null);
    if (tab === 'manual') {
      setDraft(normalizeDraft(EMPTY_DRAFT));
      setStep('review');
      return;
    }
    setParsing(true);
    try {
      if (tab === 'text') {
        if (text.trim().length < 20) throw new ApiError('Vui lòng dán nội dung CV (ít nhất vài dòng)', 400);
        applyParse(await cvParseApi.text(token, text));
      } else if (tab === 'file') {
        if (!file) throw new ApiError('Vui lòng chọn file CV', 400);
        applyParse(await cvParseApi.file(token, file));
      } else {
        if (!/^https?:\/\//i.test(url.trim())) throw new ApiError('Link phải bắt đầu bằng http:// hoặc https://', 400);
        const res = await cvParseApi.url(token, url.trim());
        applyParse(res);
        setDraft((d) => ({ ...d, sourceUrl: url.trim() }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đọc được CV — vui lòng thử lại');
    } finally {
      setParsing(false);
    }
  }

  function set<K extends keyof CandidateDraft>(key: K, value: CandidateDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const final = buildFinal(draft, skillsText, certsText);
    if (!final.fullName) return setError('Vui lòng nhập họ tên ứng viên');
    if (requireTitle && !final.profileTitle && !final.desiredPosition) {
      return setError('Vui lòng nhập chức danh / vị trí mong muốn (để nhà tuyển dụng tìm thấy hồ sơ)');
    }
    const badExp = (final.experiences ?? []).findIndex((x) => !x.position);
    if (badExp >= 0) return setError(`Kinh nghiệm #${badExp + 1}: vui lòng nhập chức danh (hoặc xoá dòng này)`);
    setSaving(true);
    try {
      await onSubmit(final, allowAttachFile && tab === 'file' ? file : null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được — vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  }

  if (step === 'source') {
    return (
      <div className="flex flex-col gap-3">
        {sourceHint && <p className="text-[12px] text-ink-faint">{sourceHint}</p>}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {(
            [
              { key: 'text', label: '📋 Dán nội dung' },
              { key: 'file', label: '📄 Tải file CV' },
              { key: 'url', label: '🔗 Dán link' },
              { key: 'manual', label: '✍️ Nhập tay' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setError(null);
              }}
              className={`px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 -mb-px ${
                tab === t.key ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'text' && (
          <textarea
            id="cv-paste-text"
            className="tvl-input min-h-[220px] text-[13px] leading-relaxed"
            placeholder="Dán toàn bộ nội dung CV (copy từ email, Zalo, Facebook, file Word…) — hệ thống tự tách họ tên, SĐT, email, kinh nghiệm, học vấn, kỹ năng…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
        {tab === 'file' && (
          <div className="rounded-xl border-2 border-dashed border-border-strong p-5 text-center">
            <input
              id="cv-upload-file"
              type="file"
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs mx-auto"
            />
            <p className="text-[11.5px] text-ink-faint mt-2">
              Đọc chữ tự động với file PDF, DOCX (tối đa 3MB). File .doc đời cũ / ảnh chụp vẫn lưu kèm được nhưng cần nhập
              tay thông tin.
            </p>
            {file && <p className="text-[12px] font-semibold mt-2">Đã chọn: {file.name}</p>}
          </div>
        )}
        {tab === 'url' && (
          <div className="flex flex-col gap-1.5">
            <input
              id="cv-source-url"
              className="tvl-input text-sm"
              placeholder="https://… (trang hồ sơ công khai, CV online, bài đăng tìm việc…)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-[11.5px] text-ink-faint">
              Chỉ đọc được trang công khai. Trang cần đăng nhập (Facebook, LinkedIn…) → hãy mở trang, copy nội dung rồi dùng
              “Dán nội dung”.
            </p>
          </div>
        )}
        {tab === 'manual' && (
          <p className="text-[12.5px] text-ink-muted">Bấm “Tiếp tục” để mở form trống và nhập thông tin ứng viên.</p>
        )}

        {error && <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{error}</div>}

        <div className="flex gap-2 justify-end">
          {onCancel && (
            <button type="button" onClick={onCancel} className="tvl-btn-ghost !w-auto px-4 text-xs">
              Huỷ
            </button>
          )}
          <button type="button" onClick={handleParse} disabled={parsing} className="tvl-btn-primary !w-auto px-5 text-xs">
            {parsing ? 'Đang đọc CV…' : tab === 'manual' ? 'Tiếp tục' : 'Đọc & tách thông tin'}
          </button>
        </div>
      </div>
    );
  }

  const exps = draft.experiences ?? [];
  const edus = draft.educations ?? [];
  const langs = draft.languages ?? [];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {notice && <div className="rounded-lg bg-info-tint text-info text-xs font-semibold px-3.5 py-2.5">{notice}</div>}

      <Section title="Thông tin chính">
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Họ và tên *">
            <input id="draft-fullName" className="tvl-input text-sm" value={draft.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </F>
          <F label={requireTitle ? 'Chức danh / vị trí mong muốn *' : 'Chức danh / vị trí mong muốn'}>
            <input
              id="draft-title"
              className="tvl-input text-sm"
              value={draft.profileTitle ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, profileTitle: e.target.value, desiredPosition: e.target.value }))}
            />
          </F>
          <F label="Số điện thoại">
            <input id="draft-phone" className="tvl-input text-sm" value={draft.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </F>
          <F label="Email">
            <input id="draft-email" className="tvl-input text-sm" value={draft.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </F>
          <F label="Ngày sinh">
            <input
              id="draft-dob"
              type="date"
              className="tvl-input text-sm"
              value={draft.dateOfBirth ?? ''}
              onChange={(e) => set('dateOfBirth', e.target.value)}
            />
          </F>
          <F label="Giới tính">
            <select id="draft-gender" className="tvl-input text-sm" value={draft.gender ?? ''} onChange={(e) => set('gender', e.target.value)}>
              <option value="">—</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </F>
          <F label="Tỉnh/thành">
            <select id="draft-province" className="tvl-input text-sm" value={draft.province ?? ''} onChange={(e) => set('province', e.target.value)}>
              <option value="">—</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </F>
          <F label="Địa chỉ">
            <input id="draft-address" className="tvl-input text-sm" value={draft.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </F>
          <F label="Số năm kinh nghiệm">
            <input
              id="draft-years"
              type="number"
              min={0}
              max={60}
              className="tvl-input text-sm"
              value={draft.yearsOfExperience ?? ''}
              onChange={(e) => set('yearsOfExperience', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </F>
          <F label="Bằng cấp cao nhất">
            <input
              id="draft-degree"
              className="tvl-input text-sm"
              value={draft.highestDegree ?? ''}
              onChange={(e) => set('highestDegree', e.target.value)}
            />
          </F>
          <F label="Lương mong muốn từ (triệu VND)">
            <input
              id="draft-salary-min"
              type="number"
              min={0}
              className="tvl-input text-sm"
              value={draft.desiredSalaryMin != null ? draft.desiredSalaryMin / 1_000_000 : ''}
              onChange={(e) => set('desiredSalaryMin', e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 1_000_000))}
            />
          </F>
          <F label="Đến (triệu VND)">
            <input
              id="draft-salary-max"
              type="number"
              min={0}
              className="tvl-input text-sm"
              value={draft.desiredSalaryMax != null ? draft.desiredSalaryMax / 1_000_000 : ''}
              onChange={(e) => set('desiredSalaryMax', e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 1_000_000))}
            />
          </F>
        </div>
        <F label="Mục tiêu nghề nghiệp / giới thiệu">
          <textarea
            id="draft-objective"
            className="tvl-input text-sm min-h-[70px]"
            value={draft.careerObjective ?? ''}
            onChange={(e) => set('careerObjective', e.target.value)}
          />
        </F>
      </Section>

      <Section
        title={`Kinh nghiệm làm việc (${exps.length})`}
        action={
          <AddButton onClick={() => set('experiences', [...exps, { position: '', isCurrent: false }])} label="＋ Thêm kinh nghiệm" />
        }
      >
        {exps.length === 0 && <Empty />}
        {exps.map((x, i) => (
          <Row key={i} onRemove={() => set('experiences', exps.filter((_, j) => j !== i))}>
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                className="tvl-input text-sm"
                placeholder="Chức danh *"
                value={x.position}
                onChange={(e) => set('experiences', patch(exps, i, { position: e.target.value }))}
              />
              <input
                className="tvl-input text-sm"
                placeholder="Công ty"
                value={x.companyName ?? ''}
                onChange={(e) => set('experiences', patch(exps, i, { companyName: e.target.value }))}
              />
              <DateRange
                start={x.startDate}
                end={x.endDate}
                isCurrent={x.isCurrent}
                onChange={(v) => set('experiences', patch(exps, i, v))}
              />
            </div>
            <textarea
              className="tvl-input text-[12.5px] min-h-[60px] mt-2"
              placeholder="Mô tả công việc"
              value={x.description ?? ''}
              onChange={(e) => set('experiences', patch(exps, i, { description: e.target.value }))}
            />
          </Row>
        ))}
      </Section>

      <Section
        title={`Học vấn (${edus.length})`}
        action={<AddButton onClick={() => set('educations', [...edus, {}])} label="＋ Thêm học vấn" />}
      >
        {edus.length === 0 && <Empty />}
        {edus.map((x, i) => (
          <Row key={i} onRemove={() => set('educations', edus.filter((_, j) => j !== i))}>
            <div className="grid sm:grid-cols-3 gap-2">
              <input
                className="tvl-input text-sm sm:col-span-3"
                placeholder="Trường"
                value={x.schoolName ?? ''}
                onChange={(e) => set('educations', patch(edus, i, { schoolName: e.target.value }))}
              />
              <input
                className="tvl-input text-sm"
                placeholder="Bằng cấp"
                value={x.degree ?? ''}
                onChange={(e) => set('educations', patch(edus, i, { degree: e.target.value }))}
              />
              <input
                className="tvl-input text-sm sm:col-span-2"
                placeholder="Chuyên ngành"
                value={x.major ?? ''}
                onChange={(e) => set('educations', patch(edus, i, { major: e.target.value }))}
              />
              <DateRange start={x.startDate} end={x.endDate} onChange={(v) => set('educations', patch(edus, i, v))} />
            </div>
          </Row>
        ))}
      </Section>

      <Section title="Kỹ năng, ngoại ngữ, chứng chỉ">
        <F label="Kỹ năng (cách nhau bằng dấu phẩy)">
          <input id="draft-skills" className="tvl-input text-sm" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
        </F>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">Ngoại ngữ</span>
            <AddButton onClick={() => set('languages', [...langs, { language: '', level: 'fair' }])} label="＋ Thêm" />
          </div>
          {langs.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className="tvl-input text-sm flex-1"
                placeholder="Ngôn ngữ"
                value={l.language}
                onChange={(e) => set('languages', patch(langs, i, { language: e.target.value }))}
              />
              <select
                className="tvl-input !w-auto text-sm"
                value={l.level ?? ''}
                onChange={(e) => set('languages', patch(langs, i, { level: e.target.value || undefined }))}
              >
                <option value="">—</option>
                {LANGUAGE_LEVELS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-critical text-xs font-bold px-1"
                onClick={() => set('languages', langs.filter((_, j) => j !== i))}
                aria-label="Xoá ngoại ngữ"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <F label="Chứng chỉ (mỗi dòng 1 chứng chỉ)">
          <textarea id="draft-certs" className="tvl-input text-sm min-h-[56px]" value={certsText} onChange={(e) => setCertsText(e.target.value)} />
        </F>
      </Section>

      <Section title="Nguồn CV">
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Lấy từ đâu">
            <input
              id="draft-source-label"
              className="tvl-input text-sm"
              placeholder="VD: Email, Zalo, nhóm Facebook Việc làm Hà Nội…"
              value={draft.sourceLabel ?? ''}
              onChange={(e) => set('sourceLabel', e.target.value)}
            />
          </F>
          <F label="Link gốc (nếu có)">
            <input
              id="draft-source-url"
              className="tvl-input text-sm"
              value={draft.sourceUrl ?? ''}
              onChange={(e) => set('sourceUrl', e.target.value)}
            />
          </F>
        </div>
        <div>
          <button type="button" className="text-xs font-bold text-primary" onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? '▾ Ẩn toàn văn CV' : '▸ Xem / sửa toàn văn CV'} ({formatLen(draft.rawText)})
          </button>
          {showRaw && (
            <textarea
              id="draft-raw"
              className="tvl-input text-[12px] min-h-[160px] mt-2 font-mono"
              value={draft.rawText ?? ''}
              onChange={(e) => set('rawText', e.target.value)}
            />
          )}
          <p className="text-[11px] text-ink-faint mt-1">
            Toàn văn luôn được lưu kèm để tìm kiếm lại theo mọi từ khoá có trong CV.
          </p>
        </div>
      </Section>

      {extra}

      {error && <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{error}</div>}

      <div className="flex gap-2 justify-end flex-wrap">
        {!initialDraft && (
          <button type="button" onClick={() => setStep('source')} className="tvl-btn-ghost !w-auto px-4 text-xs">
            ‹ Chọn nguồn khác
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className="tvl-btn-ghost !w-auto px-4 text-xs">
            Huỷ
          </button>
        )}
        <button type="submit" disabled={saving} className="tvl-btn-primary !w-auto px-5 text-xs">
          {saving ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function normalizeDraft(d: CandidateDraft): CandidateDraft {
  return {
    ...d,
    fullName: d.fullName ?? '',
    profileTitle: d.profileTitle ?? d.desiredPosition,
    experiences: (d.experiences ?? []).map((x) => ({ ...x, isCurrent: !!x.isCurrent })),
    educations: d.educations ?? [],
    skills: d.skills ?? [],
    languages: d.languages ?? [],
    certificates: d.certificates ?? [],
  };
}

// Bỏ trường rỗng + chuẩn hoá trước khi gửi (validate phía máy chủ không nhận chuỗi rỗng cho ngày tháng).
function buildFinal(d: CandidateDraft, skillsText: string, certsText: string): CandidateDraft {
  const clean = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  const date = (v?: string) => (v && /^\d{4}-\d{2}(-\d{2})?$/.test(v) ? (v.length === 7 ? `${v}-01` : v) : undefined);
  const out: CandidateDraft = {
    fullName: d.fullName.trim(),
    profileTitle: clean(d.profileTitle),
    desiredPosition: clean(d.desiredPosition) ?? clean(d.profileTitle),
    phone: clean(d.phone),
    email: clean(d.email),
    dateOfBirth: date(d.dateOfBirth),
    gender: clean(d.gender),
    province: clean(d.province),
    address: clean(d.address),
    desiredLevel: clean(d.desiredLevel),
    desiredSalaryMin: d.desiredSalaryMin ?? undefined,
    desiredSalaryMax: d.desiredSalaryMax ?? undefined,
    yearsOfExperience: d.yearsOfExperience ?? undefined,
    highestDegree: clean(d.highestDegree),
    careerObjective: clean(d.careerObjective),
    desiredIndustries: d.desiredIndustries?.length ? d.desiredIndustries : undefined,
    desiredLocations: d.desiredLocations?.length ? d.desiredLocations : undefined,
    experiences: (d.experiences ?? [])
      .filter((x) => x.position?.trim() || x.companyName?.trim() || x.description?.trim())
      .map((x) => ({
        position: x.position?.trim() ?? '',
        companyName: clean(x.companyName),
        startDate: date(x.startDate),
        endDate: x.isCurrent ? undefined : date(x.endDate),
        isCurrent: !!x.isCurrent,
        description: clean(x.description),
      })),
    educations: (d.educations ?? [])
      .filter((x) => x.schoolName?.trim() || x.degree?.trim() || x.major?.trim())
      .map((x) => ({
        schoolName: clean(x.schoolName),
        degree: clean(x.degree),
        major: clean(x.major),
        startDate: date(x.startDate),
        endDate: date(x.endDate),
      })),
    skills: Array.from(new Set(skillsText.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))).slice(0, 50),
    languages: (d.languages ?? []).filter((l) => l.language.trim()).map((l) => ({ language: l.language.trim(), level: l.level || undefined })),
    certificates: certsText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 30),
    rawText: clean(d.rawText),
    sourceLabel: clean(d.sourceLabel),
    sourceUrl: clean(d.sourceUrl),
    jobPostingId: d.jobPostingId,
  };
  return out;
}

function countFound(d: CandidateDraft) {
  return [
    d.fullName,
    d.phone,
    d.email,
    d.profileTitle,
    d.province,
    d.dateOfBirth,
    d.careerObjective,
    d.experiences?.length,
    d.educations?.length,
    d.skills?.length,
    d.languages?.length,
    d.certificates?.length,
  ].filter(Boolean).length;
}

function formatLen(t?: string) {
  const n = (t ?? '').length;
  return n ? `${n.toLocaleString('vi-VN')} ký tự` : 'trống';
}

function patch<T>(arr: T[], i: number, v: Partial<T>): T[] {
  return arr.map((x, j) => (j === i ? { ...x, ...v } : x));
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[12.5px] font-extrabold text-ink uppercase tracking-wide">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] font-bold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="rounded-lg bg-surface-alt p-2.5 relative">
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1.5 right-2 text-critical text-xs font-bold"
        aria-label="Xoá dòng"
      >
        ✕
      </button>
      <div className="pr-5">{children}</div>
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="text-[11.5px] font-bold text-primary whitespace-nowrap">
      {label}
    </button>
  );
}

function Empty() {
  return <p className="text-[12px] text-ink-faint">Chưa có — bấm “Thêm” nếu cần.</p>;
}

function DateRange({
  start,
  end,
  isCurrent,
  onChange,
}: {
  start?: string;
  end?: string;
  isCurrent?: boolean;
  onChange: (v: Partial<DraftExperience & DraftEducation>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 text-[12px]">
      <input
        type="month"
        className="tvl-input !w-auto text-sm"
        value={(start ?? '').slice(0, 7)}
        onChange={(e) => onChange({ startDate: e.target.value ? `${e.target.value}-01` : undefined })}
        aria-label="Từ tháng"
      />
      <span className="text-ink-faint">→</span>
      {isCurrent ? (
        <span className="font-semibold text-success">Hiện tại</span>
      ) : (
        <input
          type="month"
          className="tvl-input !w-auto text-sm"
          value={(end ?? '').slice(0, 7)}
          onChange={(e) => onChange({ endDate: e.target.value ? `${e.target.value}-01` : undefined })}
          aria-label="Đến tháng"
        />
      )}
      {isCurrent !== undefined && (
        <label className="flex items-center gap-1 ml-1">
          <input type="checkbox" checked={isCurrent} onChange={(e) => onChange({ isCurrent: e.target.checked })} />
          Đang làm
        </label>
      )}
    </div>
  );
}
