// Đợt 10 — icon nhỏ cho tag phúc lợi trên thẻ việc làm (mục 4 đặc tả). Khớp theo từ khóa trong tên
// phúc lợi (dữ liệu phúc lợi là chữ tự do do NTD nhập ở /nha-tuyen-dung/dang-tin).
const RULES: [RegExp, string][] = [
  [/laptop|macbook|thiết bị/i, '💻'],
  [/bảo hiểm/i, '🩺'],
  [/du lịch/i, '✈️'],
  [/thưởng|kpi|lương tháng 13/i, '💰'],
  [/đào tạo|học/i, '🎓'],
  [/linh hoạt|remote|hybrid/i, '🏠'],
  [/ăn|cơm|bữa/i, '🍽️'],
  [/đồng phục/i, '👕'],
  [/lễ|tết/i, '🎉'],
  [/tăng lương/i, '📈'],
];

export function benefitIcon(label: string): string {
  const rule = RULES.find(([re]) => re.test(label));
  return rule ? rule[1] : '✔️';
}
