// Đợt 18f (26/09/2026) — tìm kiếm "gõ không dấu vẫn ra" ngay trong câu SQL (danh sách Admin), không
// cần extension `unaccent` của Postgres (Supabase có nhưng phải bật tay) — dùng hàm có sẵn translate()
// với bảng chữ tiếng Việt có dấu → không dấu. Cặp với normalizeSearchText() ở phía từ khoá.
const GROUPS: [string, string][] = [
  ['àáạảãâầấậẩẫăằắặẳẵ', 'a'],
  ['èéẹẻẽêềếệểễ', 'e'],
  ['ìíịỉĩ', 'i'],
  ['òóọỏõôồốộổỗơờớợởỡ', 'o'],
  ['ùúụủũưừứựửữ', 'u'],
  ['ỳýỵỷỹ', 'y'],
  ['đ', 'd'],
];
const FROM = GROUPS.map(([chars]) => chars).join('');
const TO = GROUPS.map(([chars, base]) => base.repeat([...chars].length)).join(
  '',
);

export function unaccentSql(expr: string): string {
  return `translate(lower(${expr}), '${FROM}', '${TO}')`;
}
