/**
 * Script tạo dữ liệu mẫu (công ty + tin tuyển dụng) để demo tìm kiếm việc làm.
 * Chạy: npm run seed
 * An toàn để chạy nhiều lần — bỏ qua nếu công ty (theo mã số thuế) đã tồn tại.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { Company, CompanyApprovalStatus } from './entities/company.entity';
import { JobPosting, JobApprovalStatus } from './entities/job-posting.entity';
import { User, UserRole } from './entities/user.entity';
import { ServicePackage } from './entities/service-package.entity';
import * as entities from './entities';

const entityList = Object.values(entities).filter(
  (e) => typeof e === 'function',
) as any[];

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: entityList,
  synchronize: false,
});

interface SeedCompany {
  name: string;
  taxCode: string;
  size?: string;
  industry?: string;
  website?: string;
  jobs: Array<{
    title: string;
    industry: string;
    location: string;
    salaryMin?: number;
    salaryMax?: number;
    employmentType: string;
    level: string;
    description: string;
    requirements: string;
    benefits: string[];
    deadline: string;
  }>;
}

const SEED: SeedCompany[] = [
  {
    name: 'Công ty TNHH Giải pháp Số Việt',
    taxCode: '0301111222',
    size: '50-150 nhân viên',
    industry: 'CNTT / Phần mềm',
    website: 'https://giaiphapsoviet.vn',
    jobs: [
      {
        title: 'Nhân viên Kinh doanh B2B',
        industry: 'Kinh doanh / Bán hàng',
        location: 'Hồ Chí Minh',
        salaryMin: 12,
        salaryMax: 18,
        employmentType: 'Toàn thời gian',
        level: 'Nhân viên',
        description:
          'Tìm kiếm và phát triển khách hàng doanh nghiệp trong lĩnh vực phần mềm quản trị; xây dựng đề xuất giải pháp phù hợp nhu cầu khách hàng; phối hợp đội kỹ thuật để triển khai hợp đồng; đạt chỉ tiêu doanh số hàng quý.',
        requirements:
          'Tốt nghiệp Cao đẳng/Đại học, ưu tiên khối ngành Kinh tế\nTối thiểu 1 năm kinh nghiệm bán hàng B2B\nKỹ năng giao tiếp và đàm phán tốt',
        benefits: ['Bảo hiểm sức khỏe', 'Thưởng KPI', 'Laptop', 'Du lịch hằng năm'],
        deadline: '2026-10-30',
      },
      {
        title: 'FE Developer (React)',
        industry: 'CNTT / Phần mềm',
        location: 'Hà Nội',
        salaryMin: 20,
        salaryMax: 30,
        employmentType: 'Toàn thời gian',
        level: 'Nhân viên',
        description:
          'Xây dựng và bảo trì giao diện web bằng React/Next.js cho các sản phẩm SaaS nội bộ; phối hợp cùng đội backend và thiết kế để hoàn thiện trải nghiệm người dùng.',
        requirements:
          'Tối thiểu 1 năm kinh nghiệm với React/TypeScript\nHiểu biết cơ bản về REST API\nCó tinh thần trách nhiệm, chủ động học hỏi',
        benefits: ['Bảo hiểm sức khỏe', 'Laptop', 'Làm việc linh hoạt'],
        deadline: '2026-11-15',
      },
    ],
  },
  {
    name: 'Tập đoàn Bán lẻ Hoa Mai',
    taxCode: '0302222333',
    size: '500-1000 nhân viên',
    industry: 'Bán lẻ',
    jobs: [
      {
        title: 'Giám sát Bán hàng Khu vực',
        industry: 'Kinh doanh / Bán hàng',
        location: 'Bình Dương',
        employmentType: 'Toàn thời gian',
        level: 'Giám sát / Trưởng nhóm',
        description:
          'Quản lý và giám sát hoạt động bán hàng tại các cửa hàng khu vực Bình Dương; đào tạo và hỗ trợ đội ngũ nhân viên bán hàng; báo cáo kết quả kinh doanh định kỳ.',
        requirements:
          'Tối thiểu 2 năm kinh nghiệm quản lý bán hàng bán lẻ\nCó khả năng đi công tác trong khu vực\nKỹ năng lãnh đạo đội nhóm',
        benefits: ['Xe đưa đón', 'Thưởng doanh số', 'Bảo hiểm sức khỏe'],
        deadline: '2026-11-05',
      },
    ],
  },
  {
    name: 'FinTech Ánh Dương',
    taxCode: '0303333444',
    size: '100-300 nhân viên',
    industry: 'CNTT / Phần mềm',
    jobs: [
      {
        title: 'Account Executive',
        industry: 'Kinh doanh / Bán hàng',
        location: 'Hà Nội',
        employmentType: 'Toàn thời gian',
        level: 'Nhân viên',
        description:
          'Tư vấn và phát triển khách hàng doanh nghiệp sử dụng nền tảng thanh toán số; duy trì quan hệ khách hàng hiện hữu.',
        requirements: 'Kinh nghiệm bán hàng B2B trong lĩnh vực tài chính/công nghệ là lợi thế',
        benefits: ['Bảo hiểm sức khỏe', 'Thưởng KPI'],
        deadline: '2026-11-20',
      },
    ],
  },
  {
    name: 'Bệnh viện Đa khoa Tâm An',
    taxCode: '0304444555',
    size: '300-500 nhân viên',
    industry: 'Y tế / Dược',
    jobs: [
      {
        title: 'Điều dưỡng viên',
        industry: 'Y tế / Dược',
        location: 'Đà Nẵng',
        employmentType: 'Toàn thời gian',
        level: 'Nhân viên',
        description: 'Chăm sóc và theo dõi tình trạng bệnh nhân theo chỉ định của bác sĩ; hỗ trợ các thủ thuật y khoa.',
        requirements: 'Tốt nghiệp Cao đẳng/Đại học Điều dưỡng\nCó chứng chỉ hành nghề',
        benefits: ['Bảo hiểm sức khỏe', 'Phụ cấp ca đêm', 'Đào tạo chuyên môn'],
        deadline: '2026-10-20',
      },
    ],
  },
  {
    name: 'Công ty TNHH Sản xuất Cơ khí Đại Phát',
    taxCode: '0305555666',
    size: '150-300 nhân viên',
    industry: 'Sản xuất / Cơ khí',
    jobs: [
      {
        title: 'Kỹ sư Cơ khí Bảo trì',
        industry: 'Sản xuất / Cơ khí',
        location: 'Bình Dương',
        salaryMin: 15,
        salaryMax: 22,
        employmentType: 'Toàn thời gian',
        level: 'Nhân viên',
        description: 'Bảo trì, sửa chữa hệ thống máy móc sản xuất; lập kế hoạch bảo trì định kỳ.',
        requirements: 'Tốt nghiệp Cao đẳng/Đại học Cơ khí\nCó kinh nghiệm bảo trì máy công nghiệp',
        benefits: ['Xe đưa đón', 'Phụ cấp ca'],
        deadline: '2026-10-12',
      },
    ],
  },
  {
    name: 'Công ty CP Logistics Phương Đông',
    taxCode: '0306666777',
    size: '100-300 nhân viên',
    industry: 'Logistics',
    jobs: [
      {
        title: 'Trưởng nhóm Vận hành Kho',
        industry: 'Logistics',
        location: 'Đồng Nai',
        employmentType: 'Toàn thời gian',
        level: 'Giám sát / Trưởng nhóm',
        description: 'Quản lý vận hành kho hàng, điều phối đội ngũ nhân viên kho, đảm bảo tiến độ xuất nhập hàng.',
        requirements: 'Tối thiểu 2 năm kinh nghiệm vận hành kho/logistics',
        benefits: ['Bảo hiểm sức khỏe', 'Nghỉ phép năm'],
        deadline: '2026-11-05',
      },
    ],
  },
  {
    name: 'Chuỗi nhà hàng Vị Quê',
    taxCode: '0307777888',
    size: '50-150 nhân viên',
    industry: 'Nhà hàng / Khách sạn',
    jobs: [
      {
        title: 'Nhân viên Chăm sóc Khách hàng',
        industry: 'Dịch vụ khách hàng',
        location: 'Hồ Chí Minh',
        salaryMin: 8,
        salaryMax: 12,
        employmentType: 'Toàn thời gian',
        level: 'Nhân viên',
        description: 'Tiếp nhận và xử lý phản hồi, khiếu nại của khách hàng; hỗ trợ đặt bàn và chăm sóc khách VIP.',
        requirements: 'Giao tiếp tốt, ưu tiên có kinh nghiệm ngành F&B',
        benefits: ['Thưởng lễ Tết', 'Đồng phục', 'Ăn ca'],
        deadline: '2026-10-20',
      },
    ],
  },
];

async function run() {
  await dataSource.initialize();
  const companyRepo = dataSource.getRepository(Company);
  const jobRepo = dataSource.getRepository(JobPosting);

  let createdCompanies = 0;
  let createdJobs = 0;

  for (const seedCompany of SEED) {
    let company = await companyRepo.findOne({ where: { taxCode: seedCompany.taxCode } });
    if (!company) {
      company = await companyRepo.save(
        companyRepo.create({
          name: seedCompany.name,
          taxCode: seedCompany.taxCode,
          size: seedCompany.size,
          industry: seedCompany.industry,
          website: seedCompany.website,
          approvalStatus: CompanyApprovalStatus.APPROVED,
        }),
      );
      createdCompanies++;
    }

    for (const job of seedCompany.jobs) {
      const exists = await jobRepo.findOne({ where: { companyId: company.id, title: job.title } });
      if (exists) continue;
      await jobRepo.save(
        jobRepo.create({
          companyId: company.id,
          title: job.title,
          industry: job.industry,
          location: job.location,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          employmentType: job.employmentType,
          level: job.level,
          headcount: 1,
          description: job.description,
          requirements: job.requirements,
          // Đợt 14 (25/09/2026) — `benefits` ở entity đổi sang rich text (string) — SEED constant ở
          // trên vẫn giữ dạng mảng cho dễ đọc/sửa, chuyển thành các đoạn <p> khi ghi vào CSDL.
          benefits: job.benefits.map((b) => `<p>${b}</p>`).join(''),
          deadline: job.deadline,
          approvalStatus: JobApprovalStatus.APPROVED,
        }),
      );
      createdJobs++;
    }
  }

  // Đợt 10 — bù dữ liệu tỉnh/thành, quận/huyện, khẩn cấp, doanh nghiệp yêu thích cho các bản ghi
  // đợt 7 sẵn có (an toàn chạy nhiều lần — chỉ set khi còn trống).
  const HCM_DISTRICTS = ['Quận 1', 'Quận 3', 'Quận 7', 'Thành phố Thủ Đức'];
  const allJobs = await jobRepo.find();
  let backfilledJobs = 0;
  for (let i = 0; i < allJobs.length; i++) {
    const job = allJobs[i];
    let changed = false;
    if (!job.provinces && job.location) {
      job.provinces = job.location.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
      changed = true;
    }
    if (!job.district && job.location?.includes('Hồ Chí Minh')) {
      job.district = HCM_DISTRICTS[i % HCM_DISTRICTS.length];
      changed = true;
    }
    if (!job.experienceLevel) {
      job.experienceLevel = job.level === 'Nhân viên' ? 'Từ 1 đến 4 năm' : 'Không yêu cầu kinh nghiệm';
      changed = true;
    }
    if (i < 2 && !job.isUrgent) {
      job.isUrgent = true;
      changed = true;
    }
    if (changed) {
      await jobRepo.save(job);
      backfilledJobs++;
    }
  }

  const featuredNames = ['Công ty TNHH Giải pháp Số Việt', 'Tập đoàn Bán lẻ Hoa Mai', 'FinTech Ánh Dương'];
  for (const name of featuredNames) {
    await companyRepo.update({ name }, { isFeaturedEmployer: true });
  }

  // Tài khoản Admin mẫu (dev-only) — dùng để đăng nhập trang /admin/dashboard và duyệt
  // công ty/tin tuyển dụng. Đổi mật khẩu này trước khi triển khai thật.
  const userRepo = dataSource.getRepository(User);
  const adminEmail = 'admin@tuyendungvieclam.vn';
  let admin = await userRepo.findOne({ where: { email: adminEmail } });
  let createdAdmin = false;
  if (!admin) {
    const passwordHash = await argon2.hash('Admin@123');
    admin = await userRepo.save(
      userRepo.create({ email: adminEmail, passwordHash, role: UserRole.ADMIN }),
    );
    createdAdmin = true;
  }

  // Gói dịch vụ mẫu (SRS Mục 10 / màn B4 "Gói dịch vụ & thanh toán") — giá và tên khớp mockup.
  const packageRepo = dataSource.getRepository(ServicePackage);
  const SEED_PACKAGES: Array<{
    name: string;
    type: string;
    quantity: number;
    durationDays: number;
    price: number;
  }> = [
    { name: 'Không giới hạn 1 tháng', type: 'job_posting', quantity: 9999, durationDays: 30, price: 2_990_000 },
    { name: 'Combo Tăng trưởng', type: 'combo', quantity: 20, durationDays: 60, price: 6_490_000 },
    { name: 'RD 50 điểm · 30 ngày', type: 'cv_search', quantity: 50, durationDays: 30, price: 1_590_000 },
  ];
  let createdPackages = 0;
  for (const pkg of SEED_PACKAGES) {
    const exists = await packageRepo.findOne({ where: { name: pkg.name } });
    if (exists) continue;
    await packageRepo.save(packageRepo.create({ ...pkg, active: true }));
    createdPackages++;
  }

  console.log(`Đã tạo ${createdCompanies} công ty mới, ${createdJobs} tin tuyển dụng mới, ${createdPackages} gói dịch vụ mới.`);
  console.log(`Đã bù dữ liệu đợt 10 (tỉnh/thành, khẩn cấp...) cho ${backfilledJobs} tin, đánh dấu ${featuredNames.length} doanh nghiệp yêu thích.`);
  console.log(
    createdAdmin
      ? `Đã tạo tài khoản Admin mẫu: ${adminEmail} / Admin@123 (đổi mật khẩu trước khi triển khai thật).`
      : `Tài khoản Admin mẫu đã tồn tại: ${adminEmail}`,
  );
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Lỗi khi tạo dữ liệu mẫu:', err);
  process.exit(1);
});
