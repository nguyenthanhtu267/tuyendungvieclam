'use client';

import { Combobox } from '@/components/ui/Combobox';

// Đợt 127 → Đợt 135: dùng chung ô chọn gõ-để-tìm của toàn web (components/ui/Combobox).
export function SearchSelect({ id, value, options, placeholder, onChange }: { id?: string; value: string; options: string[]; placeholder?: string; onChange: (v: string) => void }) {
  return <Combobox id={id} value={value} options={options} placeholder={placeholder ?? '— Chọn hoặc gõ để tìm —'} onChange={onChange} />;
}
