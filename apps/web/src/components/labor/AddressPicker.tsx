'use client';

import { dismissKeyboard } from '@/lib/mobile-ui';
import { Combobox } from '@/components/ui/Combobox';
import { useEffect, useMemo, useState } from 'react';
import { workersApi } from '@/lib/api';

export interface AddressValue {
  province: string;
  addressMode: 'old' | 'new';
  oldDistrict: string;
  oldWard: string;
  newWardCode: string;
  newWardName: string;
}
export const EMPTY_ADDRESS: AddressValue = { province: '', addressMode: 'old', oldDistrict: '', oldWard: '', newWardCode: '', newWardName: '' };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Đợt 79 — chọn địa chỉ: Tỉnh → (quận/huyện CŨ → phường/xã CŨ) hoặc (gõ tên phường/xã MỚI sau sáp nhập 7/2025).
export function AddressPicker({
  value,
  onChange,
  provinces,
  idPrefix,
  requireWard = true,
}: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  provinces: string[];
  idPrefix: string;
  requireWard?: boolean;
}) {
  const [districts, setDistricts] = useState<string[]>([]);
  const [wards, setWards] = useState<string[]>([]);
  const [newWards, setNewWards] = useState<{ code: string; name: string }[]>([]);
  const [typed, setTyped] = useState(value.newWardName);
  const [open, setOpen] = useState(false);
  const set = (p: Partial<AddressValue>) => onChange({ ...value, ...p });
  const [hint, setHint] = useState(false);
  // Chưa chọn tỉnh: không cho mở danh sách mà dẫn người dùng về ô Tỉnh/Thành (thay vì ô mờ khó hiểu)
  const needProvince = (e: { preventDefault: () => void }) => {
    if (value.province) return;
    e.preventDefault();
    setHint(true);
    const el = document.getElementById(`${idPrefix}-prov`) as HTMLSelectElement | null;
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  useEffect(() => { if (value.province) setHint(false); }, [value.province]);
  const needDistrict = (e: { preventDefault: () => void }) => {
    if (value.oldDistrict) return;
    e.preventDefault();
    (document.getElementById(`${idPrefix}-dist`) as HTMLSelectElement | null)?.focus();
  };

  useEffect(() => {
    setDistricts([]);
    setNewWards([]);
    if (!value.province) return;
    workersApi.districts(value.province).then((r) => setDistricts(r.items)).catch(() => undefined);
    workersApi.newWards(value.province).then((r) => setNewWards(r.items)).catch(() => undefined);
  }, [value.province]);
  useEffect(() => {
    setWards([]);
    if (!value.province || !value.oldDistrict) return;
    workersApi.wards(value.province, value.oldDistrict).then((r) => setWards(r.items)).catch(() => undefined);
  }, [value.province, value.oldDistrict]);
  useEffect(() => setTyped(value.newWardName), [value.newWardName]);

  const suggestions = useMemo(() => {
    const t = fold(typed.trim());
    const list = t ? newWards.filter((w) => fold(w.name).includes(t)) : newWards;
    return list.slice(0, 40);
  }, [typed, newWards]);

  const req = requireWard ? ' *' : '';
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-[14px] font-bold text-ink" htmlFor={`${idPrefix}-prov`}>
        Tỉnh / Thành phố{req}
        <Combobox
          id={`${idPrefix}-prov`}
          className={`w-full ${hint ? '[&_input]:!border-critical [&_input]:!ring-2 [&_input]:!ring-critical' : ''}`}
          inputClassName="font-normal"
          value={value.province}
          options={provinces}
          placeholder="— Chọn hoặc gõ tên tỉnh/thành —"
          onChange={(v) => onChange({ ...EMPTY_ADDRESS, addressMode: value.addressMode, province: v })}
        />
        {hint && <span className="text-[13px] font-bold text-critical">Vui lòng chọn Tỉnh / Thành phố trước, rồi mới chọn được Quận/huyện và Phường/xã.</span>}
      </label>

      <div role="radiogroup" aria-label="Cách chọn phường/xã" className="grid grid-cols-2 gap-1.5">
        {([
          ['old', 'Quận/huyện, phường/xã CŨ'],
          ['new', 'Phường/xã MỚI (từ 7/2025)'],
        ] as const).map(([m, l]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value.addressMode === m}
            onClick={() => set({ addressMode: m, oldDistrict: '', oldWard: '', newWardCode: '', newWardName: '' })}
            className={`rounded-lg border px-2 py-2 text-[13.5px] font-bold ${value.addressMode === m ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {value.addressMode === 'old' ? (
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[14px] font-bold text-ink" htmlFor={`${idPrefix}-dist`}>
            Quận / Huyện (cũ){req}
            <Combobox
              id={`${idPrefix}-dist`}
              inputClassName="font-normal"
              value={value.oldDistrict}
              options={districts}
              placeholder={value.province ? '— Chọn hoặc gõ quận/huyện —' : '— Chọn tỉnh/thành trước —'}
              beforeOpen={() => { if (value.province) return true; needProvince({ preventDefault: () => undefined }); return false; }}
              onChange={(v) => set({ oldDistrict: v, oldWard: '' })}
            />
          </label>
          <label className="flex flex-col gap-1 text-[14px] font-bold text-ink" htmlFor={`${idPrefix}-ward`}>
            Phường / Xã (cũ){req}
            <Combobox
              id={`${idPrefix}-ward`}
              inputClassName="font-normal"
              value={value.oldWard}
              options={wards}
              placeholder={value.oldDistrict ? '— Chọn hoặc gõ phường/xã —' : '— Chọn quận/huyện trước —'}
              beforeOpen={() => {
                if (!value.province) { needProvince({ preventDefault: () => undefined }); return false; }
                if (!value.oldDistrict) { needDistrict({ preventDefault: () => undefined }); return false; }
                return true;
              }}
              onChange={(v) => set({ oldWard: v })}
            />
          </label>
        </div>
      ) : (
        <div className="relative">
          <label className="flex flex-col gap-1 text-[14px] font-bold text-ink" htmlFor={`${idPrefix}-new`}>
            Phường / Xã mới{req}
            <input
              id={`${idPrefix}-new`}
              className="tvl-input font-normal"
              onMouseDown={needProvince}
              readOnly={!value.province}
              placeholder={value.province ? 'Gõ tên phường/xã, vd: Dĩ An' : 'Chọn tỉnh/thành trước'}
              value={typed}
              autoComplete="off"
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onChange={(e) => {
                setTyped(e.target.value);
                setOpen(true);
                if (value.newWardCode) set({ newWardCode: '', newWardName: '' });
              }}
            />
          </label>
          {open && value.province && suggestions.length > 0 && (
            <ul className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-lg border border-border-strong bg-white shadow-lg">
              {suggestions.map((w) => (
                <li key={w.code}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      set({ newWardCode: w.code, newWardName: w.name });
                      setOpen(false);
                      dismissKeyboard();
                    }}
                    className="w-full text-left px-3 py-2 text-[14px] text-ink hover:bg-surface-alt"
                  >
                    {w.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {typed && !value.newWardCode && !open && <div className="text-[12.5px] text-critical mt-1">Vui lòng chọn một phường/xã trong danh sách gợi ý.</div>}
        </div>
      )}
    </div>
  );
}
