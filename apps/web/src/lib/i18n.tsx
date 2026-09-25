'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Đợt 13 (24/09/2026) — "Chuyển đổi Tiếng Việt / Tiếng Anh" (mục 12 danh sách lỗi). Theo lựa chọn
// của người dùng: CHỈ dịch khung giao diện (menu, nút, nhãn cố định trong code) — nội dung do NTD/
// ứng viên tự nhập (mô tả công việc, hồ sơ...) giữ nguyên văn, KHÔNG dịch máy.
//
// Quyết định kỹ thuật: dùng React Context tự viết + từ điển tĩnh (vi/en) thay vì thư viện i18n định
// tuyến theo URL kiểu next-intl (route /en/..., /vi/...). Dự án có ~30+ trang App Router đã đi vào
// vận hành thật (Render/Vercel), việc thêm tiền tố ngôn ngữ vào URL đòi hỏi dời TOÀN BỘ thư mục
// app/* vào app/[locale]/* — rủi ro rất cao cho 1 lượt sửa (ảnh hưởng mọi đường link/SEO đã lên
// thật). Cách này giữ nguyên toàn bộ cấu trúc route, chỉ đổi CHỮ hiển thị theo lựa chọn client-side.
//
// PHẠM VI đã dịch trong lượt này (Đợt 13): khung điều hướng chính (SiteHeader — nhãn menu cấp 1,
// nút đăng nhập/đăng xuất, menu di động), Footer, và khối chrome trang chủ (ô tìm kiếm, nút, tiêu
// đề khu vực). Nội dung chi tiết bên trong mega-menu (danh mục ngành nghề cụ thể...) và các trang
// còn lại (trang tin tuyển dụng, hồ sơ, NTD, admin...) CHƯA dịch — để mở rộng dần ở các đợt sau theo
// từng nhóm trang, tránh làm 1 lần dễ sai sót/bỏ sót trên diện quá rộng.

export type Lang = 'vi' | 'en';

const DICT: Record<Lang, Record<string, string>> = {
  vi: {
    'nav.jobs': 'Tìm Việc Làm',
    'nav.tools': 'Tiện Ích',
    'nav.comingSoon': 'Sắp ra mắt',
    'nav.cvTemplate': 'Mẫu CV',
    'nav.careerGuide': 'Cẩm Nang Nghề Nghiệp',
    'nav.forEmployer': 'Dành Cho Nhà Tuyển Dụng',
    'nav.login': 'Đăng nhập / Đăng ký',
    'nav.logout': 'Đăng xuất',
    'nav.hello': 'Chào',
    'nav.viewAllJobs': 'Xem tất cả việc làm →',
    'nav.loggedInAs': 'Đang đăng nhập',
    'nav.openMenu': 'Mở menu',
    'nav.closeMenu': 'Đóng menu',
    'footer.rights': 'Tuyển Dụng Việc Làm',
    'footer.terms': 'Điều khoản sử dụng',
    'footer.privacy': 'Chính sách bảo mật',
    'home.eyebrowLoading': 'Đang tải...',
    'home.eyebrowJobsToday': 'việc làm đang tuyển hôm nay',
    'home.heading1': 'Tìm đúng việc,',
    'home.heading2': 'ứng tuyển nhanh trong 3 bước',
    'home.searchPlaceholder': 'Chức danh, kỹ năng hoặc tên công ty...',
    'home.searchButton': 'Tìm Việc Ngay',
    'home.advancedSearch': 'Tìm kiếm nâng cao',
    'home.featured': 'Nổi bật:',
    'home.urgentJobs': 'Việc làm khẩn cấp',
    'home.noAccount': 'Chưa có tài khoản?',
    'home.noAccountDesc': 'Đăng ký để lưu việc làm yêu thích và ứng tuyển nhanh hơn',
    'home.register': 'Đăng ký',
    'home.latestJobs': 'Việc làm mới nhất',
    'home.seeMore': 'Xem thêm →',
    'home.loadingJobs': 'Đang tải việc làm...',
    'home.noJobs': 'Chưa có tin tuyển dụng nào.',
    'home.topIndustries': 'Ngành nghề nổi bật',
    'home.showAll': 'Xem tất cả →',
    'home.collapse': 'Thu gọn ↑',
  },
  en: {
    'nav.jobs': 'Find Jobs',
    'nav.tools': 'Tools',
    'nav.comingSoon': 'Coming soon',
    'nav.cvTemplate': 'CV Templates',
    'nav.careerGuide': 'Career Guide',
    'nav.forEmployer': 'For Employers',
    'nav.login': 'Log in / Sign up',
    'nav.logout': 'Log out',
    'nav.hello': 'Hi',
    'nav.viewAllJobs': 'View all jobs →',
    'nav.loggedInAs': 'Logged in as',
    'nav.openMenu': 'Open menu',
    'nav.closeMenu': 'Close menu',
    'footer.rights': 'Tuyen Dung Viec Lam',
    'footer.terms': 'Terms of Use',
    'footer.privacy': 'Privacy Policy',
    'home.eyebrowLoading': 'Loading...',
    'home.eyebrowJobsToday': 'jobs open today',
    'home.heading1': 'Find the right job,',
    'home.heading2': 'apply in 3 quick steps',
    'home.searchPlaceholder': 'Job title, skill, or company name...',
    'home.searchButton': 'Search Jobs',
    'home.advancedSearch': 'Advanced search',
    'home.featured': 'Featured:',
    'home.urgentJobs': 'Urgent jobs',
    'home.noAccount': "Don't have an account?",
    'home.noAccountDesc': 'Sign up to save jobs you like and apply faster',
    'home.register': 'Sign up',
    'home.latestJobs': 'Latest jobs',
    'home.seeMore': 'See more →',
    'home.loadingJobs': 'Loading jobs...',
    'home.noJobs': 'No job postings yet.',
    'home.topIndustries': 'Top industries',
    'home.showAll': 'Show all →',
    'home.collapse': 'Collapse ↑',
  },
};

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: keyof typeof DICT.vi) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = 'tvl_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('vi');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'vi' || stored === 'en') setLangState(stored);
    } catch {
      // localStorage có thể chặn (chế độ ẩn danh...) — mặc định tiếng Việt, không chặn trang render.
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // bỏ qua nếu không lưu được — lựa chọn chỉ mất khi tải lại trang, không phải lỗi nghiêm trọng.
    }
  }, []);

  const toggleLang = useCallback(() => setLang(lang === 'vi' ? 'en' : 'vi'), [lang, setLang]);

  const t = useCallback((key: keyof typeof DICT.vi) => DICT[lang][key] ?? DICT.vi[key] ?? key, [lang]);

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage() phải dùng bên trong <LanguageProvider>');
  return ctx;
}
