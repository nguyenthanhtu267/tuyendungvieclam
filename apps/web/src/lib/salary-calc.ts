// Đợt 39 — Tính lương Gross ↔ Net theo quy định 2026 (đơn vị: đồng).
// Nguồn: NQ 110 (giảm trừ gia cảnh), biểu thuế TNCN 5 bậc hiệu lực 01/07/2026, mức đóng bảo hiểm người lao động 10,5%.
export const PERSONAL_DEDUCTION = 15_500_000;
export const DEPENDENT_DEDUCTION = 6_200_000;
export const BASE_SALARY = 2_340_000; // lương cơ sở
export const INS_CAP = BASE_SALARY * 20; // trần BHXH, BHYT = 46,8 triệu
export const REGION_MIN_WAGE: Record<1 | 2 | 3 | 4, number> = { 1: 5_310_000, 2: 4_730_000, 3: 4_140_000, 4: 3_700_000 };
export const RATES = { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 };

// Biểu thuế 5 bậc theo tháng: [ngưỡng trên, thuế suất]
export const BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 10_000_000, rate: 0.05 },
  { upTo: 30_000_000, rate: 0.1 },
  { upTo: 60_000_000, rate: 0.2 },
  { upTo: 100_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

export interface CalcInput {
  gross: number;
  dependents: number;
  region: 1 | 2 | 3 | 4;
  insuranceBase?: number; // mức lương đóng BH (mặc định = gross)
}
export interface CalcResult {
  gross: number;
  bhxh: number;
  bhyt: number;
  bhtn: number;
  insurance: number;
  incomeBeforeTax: number;
  deduction: number;
  taxable: number;
  tax: number;
  net: number;
  breakdown: { from: number; to: number; rate: number; amount: number; tax: number }[];
  employerCost: number;
}

export function grossToNet(inp: CalcInput): CalcResult {
  const gross = Math.max(0, Math.round(inp.gross));
  const base = inp.insuranceBase && inp.insuranceBase > 0 ? inp.insuranceBase : gross;
  const capSocial = Math.min(base, INS_CAP);
  const capTn = Math.min(base, REGION_MIN_WAGE[inp.region] * 20);
  const bhxh = Math.round(capSocial * RATES.bhxh);
  const bhyt = Math.round(capSocial * RATES.bhyt);
  const bhtn = Math.round(capTn * RATES.bhtn);
  const insurance = bhxh + bhyt + bhtn;
  const incomeBeforeTax = gross - insurance;
  const deduction = PERSONAL_DEDUCTION + DEPENDENT_DEDUCTION * Math.max(0, inp.dependents);
  const taxable = Math.max(0, incomeBeforeTax - deduction);
  let rest = taxable;
  let prev = 0;
  let tax = 0;
  const breakdown: CalcResult['breakdown'] = [];
  for (const b of BRACKETS) {
    if (rest <= 0) break;
    const amount = Math.min(rest, b.upTo - prev);
    const t = Math.round(amount * b.rate);
    breakdown.push({ from: prev, to: b.upTo, rate: b.rate, amount, tax: t });
    tax += t;
    rest -= amount;
    prev = b.upTo;
  }
  const employerIns =
    Math.round(capSocial * (0.03 + 0.03 + 0.005)) + Math.round(capSocial * 0) + Math.round(capTn * 0.01);
  return {
    gross, bhxh, bhyt, bhtn, insurance, incomeBeforeTax, deduction, taxable, tax,
    net: incomeBeforeTax - tax, breakdown, employerCost: gross + employerIns,
  };
}

// Net → Gross: tìm nhị phân vì hàm gross→net đơn điệu tăng.
export function netToGross(net: number, dependents: number, region: 1 | 2 | 3 | 4): CalcResult {
  let lo = net;
  let hi = net * 3 + 50_000_000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (grossToNet({ gross: mid, dependents, region }).net < net) lo = mid;
    else hi = mid;
  }
  return grossToNet({ gross: Math.round(hi), dependents, region });
}
