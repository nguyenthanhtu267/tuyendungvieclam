// Đợt 89 — danh mục khu công nghiệp / khu vực việc làm nổi bật theo tỉnh (từ khoá khớp vào địa chỉ làm việc của tin).
// Chỉ là gợi ý để lọc nhanh; tỉnh chưa có trong danh mục vẫn có quận/huyện, ngành nổi bật và lương trung vị.
export const PROVINCE_ZONES: Record<string, { name: string; keys: string[] }[]> = {
  'Bắc Ninh': [
    { name: 'KCN Quế Võ', keys: ['quế võ'] },
    { name: 'KCN Yên Phong', keys: ['yên phong'] },
    { name: 'KCN VSIP Bắc Ninh', keys: ['vsip', 'từ sơn'] },
    { name: 'KCN Tiên Sơn', keys: ['tiên sơn', 'tiên du'] },
    { name: 'KCN Thuận Thành', keys: ['thuận thành'] },
  ],
  'Bắc Giang': [
    { name: 'KCN Vân Trung', keys: ['vân trung'] },
    { name: 'KCN Đình Trám', keys: ['đình trám'] },
    { name: 'KCN Quang Châu', keys: ['quang châu'] },
    { name: 'KCN Việt Hàn', keys: ['việt hàn'] },
  ],
  'Hà Nội': [
    { name: 'KCN Thăng Long', keys: ['thăng long', 'đông anh'] },
    { name: 'KCN Bắc Thăng Long', keys: ['bắc thăng long', 'sóc sơn'] },
    { name: 'Khu CNC Hòa Lạc', keys: ['hòa lạc', 'thạch thất'] },
    { name: 'KCN Quang Minh', keys: ['quang minh', 'mê linh'] },
    { name: 'KCN Phú Nghĩa', keys: ['phú nghĩa', 'chương mỹ'] },
  ],
  'Hồ Chí Minh': [
    { name: 'Khu CNC Thủ Đức', keys: ['khu công nghệ cao', 'thủ đức'] },
    { name: 'KCX Tân Thuận (Quận 7)', keys: ['tân thuận', 'quận 7'] },
    { name: 'KCN Tân Bình', keys: ['tân bình'] },
    { name: 'KCN Vĩnh Lộc', keys: ['vĩnh lộc', 'bình chánh'] },
    { name: 'KCX Linh Trung', keys: ['linh trung'] },
  ],
  'Bình Dương': [
    { name: 'KCN VSIP 1', keys: ['vsip', 'thuận an'] },
    { name: 'KCN Sóng Thần', keys: ['sóng thần', 'dĩ an'] },
    { name: 'KCN Mỹ Phước', keys: ['mỹ phước', 'bến cát'] },
    { name: 'KCN Việt Hương', keys: ['việt hương'] },
    { name: 'KCN Đồng An', keys: ['đồng an'] },
  ],
  'Đồng Nai': [
    { name: 'KCN Biên Hòa 2', keys: ['biên hòa'] },
    { name: 'KCN Amata', keys: ['amata'] },
    { name: 'KCN Long Thành', keys: ['long thành'] },
    { name: 'KCN Nhơn Trạch', keys: ['nhơn trạch'] },
  ],
  'Hải Phòng': [
    { name: 'KCN Nomura', keys: ['nomura', 'an dương'] },
    { name: 'KCN Tràng Duệ', keys: ['tràng duệ'] },
    { name: 'KCN Đình Vũ', keys: ['đình vũ'] },
    { name: 'KCN VSIP Hải Phòng', keys: ['vsip', 'thủy nguyên'] },
  ],
  'Hải Dương': [
    { name: 'KCN Phúc Điền', keys: ['phúc điền'] },
    { name: 'KCN Đại An', keys: ['đại an'] },
    { name: 'KCN Nam Sách', keys: ['nam sách'] },
  ],
  'Hưng Yên': [
    { name: 'KCN Phố Nối A', keys: ['phố nối', 'mỹ hào'] },
    { name: 'KCN Thăng Long II', keys: ['thăng long ii', 'yên mỹ'] },
  ],
  'Vĩnh Phúc': [
    { name: 'KCN Bình Xuyên', keys: ['bình xuyên'] },
    { name: 'KCN Khai Quang', keys: ['khai quang'] },
  ],
  'Thái Nguyên': [
    { name: 'KCN Yên Bình (Samsung)', keys: ['yên bình', 'phổ yên'] },
    { name: 'KCN Điềm Thụy', keys: ['điềm thụy'] },
  ],
  'Long An': [
    { name: 'KCN Đức Hòa', keys: ['đức hòa'] },
    { name: 'KCN Thuận Đạo', keys: ['thuận đạo', 'bến lức'] },
  ],
  'Đà Nẵng': [
    { name: 'KCN Hòa Khánh', keys: ['hòa khánh', 'liên chiểu'] },
    { name: 'Khu CNC Đà Nẵng', keys: ['công nghệ cao'] },
  ],
};
