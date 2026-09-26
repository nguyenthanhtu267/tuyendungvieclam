import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

// Đợt 18b (26/09/2026) — chặn "SSRF" khi server tải 1 đường link do người dùng dán vào (công cụ "dán
// link CV" nay mở cho cả NTD, không chỉ Admin): chỉ cho http/https và CHỈ tới địa chỉ Internet công
// khai — không cho gọi vào mạng nội bộ của máy chủ (localhost, 10.x, 192.168.x, 169.254.x…).
function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateIp(v6.slice(7));
  return (
    v6 === '::1' ||
    v6 === '::' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe80')
  );
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Đường link không hợp lệ');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Chỉ hỗ trợ đường link http/https');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0)
    throw new BadRequestException(
      'Không tìm thấy trang web của đường link này',
    );
  if (addresses.some(isPrivateIp))
    throw new BadRequestException('Đường link không được phép');
  return url;
}
