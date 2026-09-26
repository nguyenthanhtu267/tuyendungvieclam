// Đợt 18b (26/09/2026) — đọc CHỮ từ file CV (theo lựa chọn người dùng: "quy tắc trước, AI sau").
// - PDF: thư viện `pdf-parse` (bản 2.x, chạy thẳng trong Node, không cần dịch vụ ngoài/không tốn phí).
// - DOCX: thư viện `mammoth` (đọc chữ thô từ file Word mới).
// - DOC (Word đời cũ .doc), ảnh (JPG/PNG), PDF dạng ảnh scan: KHÔNG đọc được chữ → chỉ lưu file, trạng
//   thái 'unsupported' / 'empty' để giao diện báo rõ cho người dùng thay vì im lặng.
// Không bao giờ ném lỗi ra ngoài — lỗi đọc file không được làm hỏng việc ứng tuyển/lưu Kho CV.

export type CvTextStatus = 'ok' | 'empty' | 'unsupported' | 'error';

export interface CvTextResult {
  status: CvTextStatus;
  text: string;
}

const MAX_TEXT_CHARS = 100_000;
const MIN_MEANINGFUL_CHARS = 30;

const PDF_MIME = 'application/pdf';
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function kindOf(
  mime?: string | null,
  fileName?: string | null,
): 'pdf' | 'docx' | 'other' {
  const name = (fileName ?? '').toLowerCase();
  if (mime === PDF_MIME || name.endsWith('.pdf')) return 'pdf';
  if (mime === DOCX_MIME || name.endsWith('.docx')) return 'docx';
  return 'other';
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/-- \d+ of \d+ --/g, '') // chân trang pdf-parse tự chèn giữa các trang
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

export async function extractCvText(
  buffer: Buffer | null | undefined,
  mime?: string | null,
  fileName?: string | null,
): Promise<CvTextResult> {
  if (!buffer || buffer.length === 0) return { status: 'empty', text: '' };
  const kind = kindOf(mime, fileName);
  if (kind === 'other') return { status: 'unsupported', text: '' };
  try {
    let raw = '';
    if (kind === 'pdf') {
      // require() thay vì import tĩnh: pdf-parse 2.x là gói ESM/CJS kép, nạp CJS lúc cần để không làm
      // chậm khởi động server khi chưa ai dùng tới.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require('pdf-parse') as typeof import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        raw = result.text ?? '';
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth') as {
        extractRawText: (i: { buffer: Buffer }) => Promise<{ value: string }>;
      };
      const result = await mammoth.extractRawText({ buffer });
      raw = result.value ?? '';
    }
    const text = cleanText(raw);
    if (text.replace(/\s/g, '').length < MIN_MEANINGFUL_CHARS)
      return { status: 'empty', text };
    return { status: 'ok', text };
  } catch {
    return { status: 'error', text: '' };
  }
}
