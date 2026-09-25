// Đợt 12x (21/09/2026) — tách danh sách trường có thể sửa của JobPosting ra dùng chung giữa
// EmployerService.updateJob() (NTD tự sửa tin của mình) và AdminService.adminUpdateJob() (Admin sửa
// tin trước khi duyệt, mục "Sửa toàn bộ như form NTD" theo lựa chọn người dùng) — tránh 2 danh sách
// trùng lặp dễ lệch nhau khi có trường mới (VD `tags` mới thêm ở Đợt 12v).
export const JOB_EDITABLE_FIELDS = [
  'title',
  'industry',
  'location',
  'provinces',
  'district',
  'experienceLevel',
  'isUrgent',
  'salaryMin',
  'salaryMax',
  'employmentType',
  'level',
  'headcount',
  'description',
  'requirements',
  'benefits',
  'deadline',
  'address',
  'gender',
  'ageRange',
  'workSchedule',
  'tags',
  // Đợt 12aa (24/09/2026) — "Thông tin liên hệ".
  'contactName',
  'contactEmail',
  'contactPhone',
  // Đợt 14 (25/09/2026) — mục 15: khung mô tả thêm tự do cạnh 3 trường liên hệ ở trên.
  'contactNote',
  // Đợt 17l (25/09/2026) — cho phép Admin sửa lại link nguồn ở màn "Cào lại" (xem update-job.dto.ts).
  'sourceUrl',
] as const;

// Đợt 14 (25/09/2026) — trường nào trong JOB_EDITABLE_FIELDS là rich text (HTML từ RichTextEditor),
// cần khử độc (sanitizeRichText) khi lưu. Trước đó chỉ có 'description'/'requirements' được kiểm
// tra trực tiếp bằng so sánh chuỗi ở cả EmployerService.updateJob() và AdminService.adminUpdateJob()
// — nay 'benefits' cũng là rich text nên gộp thành 1 danh sách dùng chung, tránh 2 nơi lệch nhau.
export const JOB_RICH_TEXT_FIELDS = ['description', 'requirements', 'benefits', 'contactNote'] as const;
