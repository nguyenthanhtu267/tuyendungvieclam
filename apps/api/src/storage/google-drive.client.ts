// Đợt 20 (27/09/2026) — gọi thẳng Google Drive REST API bằng fetch có sẵn của Node (không thêm thư viện
// googleapis rất nặng). Quyền `drive.file`: web CHỈ thấy/sửa được file do chính web tạo ra trong Drive của
// chủ web — không đọc được file khác của chủ web, và là quyền "không nhạy cảm" nên không cần Google thẩm định.
//
// Các địa chỉ có thể đổi qua biến môi trường chỉ để chạy kiểm thử với máy chủ Google giả lập.

export const GOOGLE_AUTH_URL =
  process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL =
  process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const DRIVE_API =
  process.env.GOOGLE_DRIVE_API_URL || 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD =
  process.env.GOOGLE_DRIVE_UPLOAD_URL ||
  'https://www.googleapis.com/upload/drive/v3';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TIMEOUT_MS = 30_000;

export class DriveError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function call(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let code: string | undefined;
      let message = body.slice(0, 300);
      try {
        const j = JSON.parse(body);
        code = j.error?.status ?? j.error ?? undefined;
        message = j.error_description ?? j.error?.message ?? message;
      } catch {
        /* không phải JSON */
      }
      throw new DriveError(
        message || `HTTP ${res.status}`,
        res.status,
        typeof code === 'string' ? code : undefined,
      );
    }
    return res;
  } finally {
    clearTimeout(t);
  }
}

export function buildAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: `${DRIVE_SCOPE} openid email`,
    access_type: 'offline',
    // Luôn hỏi lại để Google chắc chắn trả refresh_token (kể cả khi đã từng cho phép).
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${q.toString()}`;
}

export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
) {
  const res = await call(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
    scope?: string;
  };
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
) {
  const res = await call(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });
  return (await res.json()) as { access_token: string; expires_in: number };
}

// Email tài khoản Google (đọc từ id_token do Google ký — chỉ để hiển thị, không dùng để xác thực).
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'),
    );
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

export async function createFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const res = await call(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return ((await res.json()) as { id: string }).id;
}

export async function uploadFile(
  token: string,
  opts: { name: string; mimeType: string; parentId: string; data: Buffer },
): Promise<{ id: string; size: number }> {
  const boundary = `tvl${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({
    name: opts.name,
    parents: [opts.parentId],
    mimeType: opts.mimeType,
  });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${opts.mimeType}\r\n\r\n`,
    ),
    opts.data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await call(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,size`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const j = (await res.json()) as { id: string; size?: string };
  return { id: j.id, size: Number(j.size ?? opts.data.length) };
}

export async function downloadFile(token: string, id: string): Promise<Buffer> {
  const res = await call(
    `${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return Buffer.from(await res.arrayBuffer());
}

export async function copyFile(
  token: string,
  id: string,
  name: string,
  parentId: string,
): Promise<{ id: string; size: number }> {
  const res = await call(
    `${DRIVE_API}/files/${encodeURIComponent(id)}/copy?fields=id,size`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, parents: [parentId] }),
    },
  );
  const j = (await res.json()) as { id: string; size?: string };
  return { id: j.id, size: Number(j.size ?? 0) };
}

export async function deleteFile(token: string, id: string): Promise<void> {
  try {
    await call(`${DRIVE_API}/files/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    if (err instanceof DriveError && err.status === 404) return; // đã không còn
    throw err;
  }
}

export async function aboutQuota(token: string): Promise<{
  limit: number | null;
  usage: number;
  usageInDrive: number;
  email: string | null;
}> {
  const res = await call(
    `${DRIVE_API}/about?fields=storageQuota,user(emailAddress)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const j = (await res.json()) as {
    storageQuota?: { limit?: string; usage?: string; usageInDrive?: string };
    user?: { emailAddress?: string };
  };
  return {
    limit: j.storageQuota?.limit ? Number(j.storageQuota.limit) : null,
    usage: Number(j.storageQuota?.usage ?? 0),
    usageInDrive: Number(j.storageQuota?.usageInDrive ?? 0),
    email: j.user?.emailAddress ?? null,
  };
}
