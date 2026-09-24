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
] as const;
