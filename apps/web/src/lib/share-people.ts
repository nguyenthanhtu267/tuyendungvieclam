// Đợt 158 — hình minh hoạ vector: một nam, một nữ làm việc ở bàn văn phòng (nhìn từ phía trước, laptop quay lưng về người xem).
// Admin chọn: không hình / chỉ nam / chỉ nữ / cả hai. Vẽ trong khung 520×420, nền trong suốt.
export type PeopleKind = 'male' | 'female' | 'both';

const person = (kind: 'male' | 'female', cx: number) => {
  const skin = kind === 'female' ? '#F6CDAE' : '#EDBB94';
  const cloth = kind === 'female' ? '#F28C38' : '#2F6FDB';
  const hairC = kind === 'female' ? '#4A2C1A' : '#2D2A32';
  const eye = `<circle cx="${cx - 14}" cy="164" r="3.8" fill="#2B2B2B"/><circle cx="${cx + 14}" cy="164" r="3.8" fill="#2B2B2B"/>`;
  const mouth = `<path d="M${cx - 10} 178 Q${cx} 189 ${cx + 10} 178" stroke="#C2554D" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const cheeks = `<circle cx="${cx - 25}" cy="176" r="6" fill="#FF8F8F" fill-opacity=".35"/><circle cx="${cx + 25}" cy="176" r="6" fill="#FF8F8F" fill-opacity=".35"/>`;
  const torso = `<path d="M${cx - 64} 340 L${cx - 64} 262 C${cx - 64} 232 ${cx - 36} 222 ${cx - 10} 218 L${cx + 10} 218 C${cx + 36} 222 ${cx + 64} 232 ${cx + 64} 262 L${cx + 64} 340Z" fill="${cloth}"/>`;
  const arms = `<path d="M${cx - 56} 252 L${cx - 40} 318" stroke="${cloth}" stroke-width="28" stroke-linecap="round"/><path d="M${cx + 56} 252 L${cx + 40} 318" stroke="${cloth}" stroke-width="28" stroke-linecap="round"/>`;
  const neck = `<rect x="${cx - 11}" y="192" width="22" height="34" fill="${skin}"/>`;
  if (kind === 'female') {
    return (
      `<path d="M${cx - 46} 168 C${cx - 54} 226 ${cx - 42} 262 ${cx - 30} 270 L${cx + 30} 270 C${cx + 42} 262 ${cx + 54} 226 ${cx + 46} 168Z" fill="${hairC}"/>` +
      torso + arms + neck +
      `<polygon points="${cx - 17},218 ${cx + 17},218 ${cx},246" fill="${skin}"/>` +
      `<circle cx="${cx}" cy="160" r="40" fill="${skin}"/>` +
      `<path d="M${cx - 43} 160 C${cx - 46} 110 ${cx + 46} 110 ${cx + 43} 160 C${cx + 30} 138 ${cx + 6} 128 ${cx - 10} 124 C${cx - 22} 136 ${cx - 36} 148 ${cx - 43} 160Z" fill="${hairC}"/>` +
      eye + cheeks + mouth +
      `<circle cx="${cx + 38}" cy="122" r="9" fill="#FFD27A"/>`
    );
  }
  return (
    torso + arms + neck +
    `<polygon points="${cx - 22},218 ${cx},244 ${cx + 22},218 ${cx + 10},214 ${cx - 10},214" fill="#fff"/>` +
    `<polygon points="${cx - 6},230 ${cx + 6},230 ${cx + 9},266 ${cx},282 ${cx - 9},266" fill="#E5484D"/>` +
    `<circle cx="${cx - 40}" cy="164" r="7" fill="${skin}"/><circle cx="${cx + 40}" cy="164" r="7" fill="${skin}"/>` +
    `<circle cx="${cx}" cy="160" r="40" fill="${skin}"/>` +
    `<path d="M${cx - 43} 156 C${cx - 48} 106 ${cx + 48} 106 ${cx + 43} 156 C${cx + 36} 136 ${cx + 14} 126 ${cx - 8} 128 C${cx - 26} 130 ${cx - 38} 140 ${cx - 43} 156Z" fill="${hairC}"/>` +
    eye + cheeks + mouth +
    `<circle cx="${cx - 14}" cy="164" r="12" fill="none" stroke="#2B2B2B" stroke-width="3"/><circle cx="${cx + 14}" cy="164" r="12" fill="none" stroke="#2B2B2B" stroke-width="3"/><path d="M${cx - 2} 164 H${cx + 2}" stroke="#2B2B2B" stroke-width="3"/>`
  );
};

const laptop = (cx: number) =>
  `<rect x="${cx - 58}" y="266" width="116" height="62" rx="8" fill="#D6DDE9" stroke="#B3BED0" stroke-width="2"/><circle cx="${cx}" cy="297" r="6" fill="#fff" fill-opacity=".9"/>`;

const plant = (x: number) =>
  `<path d="M${x} 306 C${x - 30} 290 ${x - 26} 256 ${x - 12} 246 C${x - 6} 270 ${x - 2} 288 ${x} 306Z" fill="#35B36B"/><path d="M${x} 306 C${x + 28} 286 ${x + 30} 252 ${x + 14} 240 C${x + 8} 268 ${x + 4} 288 ${x} 306Z" fill="#4CCB80"/><path d="M${x} 306 C${x - 4} 280 ${x + 2} 258 ${x + 2} 232 C${x + 12} 262 ${x + 8} 286 ${x} 306Z" fill="#2A9A59"/><path d="M${x - 17} 304 H${x + 17} L${x + 13} 330 H${x - 13}Z" fill="#E5784F"/>`;

const mug = (x: number) =>
  `<rect x="${x - 12}" y="302" width="24" height="26" rx="4" fill="#fff"/><path d="M${x + 12} 309 q10 0 10 8 t-10 8" stroke="#fff" stroke-width="4" fill="none"/><rect x="${x - 12}" y="302" width="24" height="7" rx="3" fill="#E5484D"/>`;

export function peopleSvg(kind: PeopleKind, w = 520, h = 420): string {
  const both = kind === 'both';
  const cxs = both ? { female: 150, male: 366 } : { female: 260, male: 260 };
  let body = `<circle cx="260" cy="250" r="190" fill="#fff" fill-opacity=".22"/>`;
  if (both || kind === 'female') body += person('female', cxs.female);
  if (both || kind === 'male') body += person('male', cxs.male);
  if (both || kind === 'female') body += laptop(cxs.female);
  if (both || kind === 'male') body += laptop(cxs.male);
  body += both ? plant(486) + mug(258) : plant(420) + mug(110);
  body += `<rect x="0" y="326" width="520" height="16" rx="8" fill="#8A5A3B"/><rect x="14" y="342" width="492" height="78" fill="#C99865"/><rect x="14" y="342" width="492" height="8" fill="#000" fill-opacity=".08"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 520 420">${body}</svg>`;
}
