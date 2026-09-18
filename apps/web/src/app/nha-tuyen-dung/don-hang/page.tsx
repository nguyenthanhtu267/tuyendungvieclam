'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import { employerApi, ApiError, type ServicePackage, type Order, type PaymentMethod } from '@/lib/api';
import { formatCurrency, formatDate, ORDER_STATUS_LABEL, ORDER_STATUS_CLASS, PAYMENT_METHOD_LABEL } from '@/lib/format';

const NAV_ITEMS = [
  { id: 'packages', label: 'Gói dịch vụ' },
  { id: 'orders', label: 'Đơn hàng của tôi' },
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; enabled: boolean }[] = [
  { value: 'vnpay', label: 'VNPay / MoMo / ZaloPay', enabled: false },
  { value: 'vietqr', label: 'Chuyển khoản VietQR', enabled: false },
  { value: 'contract_vat', label: 'Hợp đồng + hoá đơn VAT', enabled: true },
];

const PACKAGE_EYEBROW: Record<string, string> = {
  job_posting: 'Đăng tin',
  cv_search: 'Tìm hồ sơ',
  combo: 'Combo',
};

function packageBullets(pkg: ServicePackage): string[] {
  switch (pkg.type) {
    case 'job_posting':
      return [
        pkg.quantity >= 999 ? 'Đăng không giới hạn số tin' : `Đăng tối đa ${pkg.quantity} tin tuyển dụng`,
        `Hiệu lực ${pkg.durationDays} ngày`,
        'Chỉnh sửa tin không giới hạn',
      ];
    case 'cv_search':
      return [`${pkg.quantity} lượt xem hồ sơ ứng viên`, `Hiệu lực ${pkg.durationDays} ngày`, 'Lọc nâng cao theo ngành'];
    default:
      return [`${pkg.quantity} lượt sử dụng dịch vụ`, `Hiệu lực ${pkg.durationDays} ngày`, 'Tiết kiệm hơn khi mua lẻ'];
  }
}

export default function DonHangPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const [tab, setTab] = useState('packages');
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('contract_vat');
  const [placing, setPlacing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  // Chỉ hiện "Đang tải…" toàn trang ở lần đầu — gọi lại sau khi đặt hàng không cần che UI.
  const loadAll = useCallback(async () => {
    if (!token) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [pkgs, ords] = await Promise.all([employerApi.listPackages(token), employerApi.listOrders(token)]);
      setPackages(pkgs);
      setOrders(ords);
      if (pkgs.length > 0) setSelectedId((cur) => cur || pkgs[0].id);
      hasLoadedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedPackage = packages.find((p) => p.id === selectedId);

  async function handlePlaceOrder() {
    if (!token || !selectedPackage) return;
    setPlacing(true);
    try {
      await employerApi.createOrder(token, { servicePackageId: selectedPackage.id, paymentMethod: 'contract_vat' });
      setToast('Đã tạo đơn hàng — đang chờ Admin xác nhận thanh toán theo hợp đồng.');
      await loadAll();
      setTab('orders');
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Không thể tạo đơn hàng, vui lòng thử lại');
    } finally {
      setPlacing(false);
    }
  }

  if (!me || !me.role.startsWith('employer')) return null;

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-4">
        <div className="flex gap-1 border-b border-border">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px ${
                tab === item.id ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {toast && (
          <div className="rounded-lg bg-info-tint text-info text-xs font-semibold px-3.5 py-2.5">{toast}</div>
        )}

        {loading ? (
          <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
        ) : tab === 'packages' ? (
          <div className="grid md:grid-cols-[2.2fr_1fr] gap-4 items-start">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {packages.length === 0 ? (
                <div className="text-center text-ink-faint text-sm py-10 col-span-full">
                  Hiện chưa có gói dịch vụ nào khả dụng.
                </div>
              ) : (
                packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedId(pkg.id)}
                    className={`text-left rounded-xl border bg-white p-4 flex flex-col gap-2.5 transition-colors ${
                      selectedId === pkg.id ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-border-strong'
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase text-accent">
                      {PACKAGE_EYEBROW[pkg.type] ?? pkg.type}
                    </div>
                    <h3 className="font-bold text-[15px]">{pkg.name}</h3>
                    <div className="text-xl font-extrabold text-primary tabular-nums">{formatCurrency(pkg.price)}</div>
                    <ul className="text-xs text-ink-faint flex flex-col gap-1 list-disc pl-4 flex-1">
                      {packageBullets(pkg).map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    <div
                      className={`text-center text-xs font-bold rounded-lg py-2 ${
                        selectedId === pkg.id ? 'bg-accent text-white' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {selectedId === pkg.id ? 'Đã chọn' : 'Chọn gói'}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="rounded-xl border border-border bg-white p-4 sticky top-[70px] flex flex-col gap-3">
              <div className="text-[11px] font-bold uppercase text-ink-faint">Giỏ hàng</div>
              {selectedPackage ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span>{selectedPackage.name}</span>
                    <span className="tabular-nums font-semibold">{formatCurrency(selectedPackage.price)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold pt-2.5 border-t border-border">
                    <span>Tổng cộng</span>
                    <span className="tabular-nums text-primary">{formatCurrency(selectedPackage.price)}</span>
                  </div>
                  <div className="text-[11px] font-bold uppercase text-ink-faint mt-1">Phương thức thanh toán</div>
                  <div className="flex flex-col gap-1.5 text-xs">
                    {PAYMENT_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-2 ${opt.enabled ? '' : 'opacity-50 cursor-not-allowed'}`}
                        title={opt.enabled ? undefined : 'Sắp ra mắt — cần tích hợp cổng thanh toán thật'}
                      >
                        <input
                          type="radio"
                          name="pm"
                          disabled={!opt.enabled}
                          checked={paymentMethod === opt.value}
                          onChange={() => setPaymentMethod(opt.value)}
                        />
                        {opt.label}
                        {!opt.enabled && <span className="text-[10px] text-ink-faint">(Sắp ra mắt)</span>}
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={placing}
                    className="tvl-btn-accent mt-1.5"
                  >
                    {placing ? 'Đang tạo đơn…' : 'Đặt hàng'}
                  </button>
                  <div className="text-[10.5px] text-ink-faint">
                    Đơn hàng sẽ ở trạng thái &quot;Chờ xác nhận&quot; cho tới khi ký hợp đồng và Admin xác nhận đã
                    thanh toán.
                  </div>
                </>
              ) : (
                <div className="text-xs text-ink-faint">Chọn một gói dịch vụ để tiếp tục</div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-white border border-border overflow-hidden">
            {orders.length === 0 ? (
              <div className="text-center text-ink-faint text-sm py-16">Bạn chưa có đơn hàng nào.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-ink-faint bg-surface-alt">
                      <th className="py-2.5 px-4 font-semibold">Số đơn</th>
                      <th className="py-2.5 px-3 font-semibold">Gói dịch vụ</th>
                      <th className="py-2.5 px-3 font-semibold">Số lượng</th>
                      <th className="py-2.5 px-3 font-semibold">Còn lại</th>
                      <th className="py-2.5 px-3 font-semibold">Phương thức</th>
                      <th className="py-2.5 px-3 font-semibold">Hết hạn</th>
                      <th className="py-2.5 px-4 font-semibold">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="py-3 px-4 tabular-nums font-semibold">{o.id.slice(0, 8)}</td>
                        <td className="py-3 px-3">{o.servicePackage?.name ?? '—'}</td>
                        <td className="py-3 px-3 tabular-nums">{o.quantity}</td>
                        <td className="py-3 px-3 tabular-nums">{o.remaining}</td>
                        <td className="py-3 px-3">{PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}</td>
                        <td className="py-3 px-3 tabular-nums whitespace-nowrap">
                          {o.expiresAt ? formatDate(o.expiresAt) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${ORDER_STATUS_CLASS[o.status]}`}
                          >
                            {ORDER_STATUS_LABEL[o.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
