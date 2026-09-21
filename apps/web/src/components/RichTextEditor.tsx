'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { useEffect } from 'react';

// Đợt 12n (21/09/2026) — thay ô <textarea> nhập JD (NTD) và các ô mô tả dài trong hồ sơ CV (ứng
// viên) bằng trình soạn thảo có định dạng kiểu Word: đậm/nghiêng/gạch chân, gạch đầu dòng, đánh số,
// Tab/Shift+Tab để thụt/nhô mục danh sách (có sẵn trong @tiptap/starter-kit v3), kéo giãn chiều cao
// bằng tay (CSS resize) thay vì ô cố định 1 khung nhỏ. Nội dung lưu dạng HTML — xem lib/richtext.ts
// và RichTextView.tsx cho phần hiển thị + khử độc (sanitize) tương ứng.
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 220,
  id,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  id?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: 'tvl-richtext-content',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  // Đồng bộ khi giá trị được set lại từ bên ngoài (VD: mở lại modal sửa, hoặc load tin để "Sửa tin")
  // mà không phá vị trí con trỏ của người dùng đang gõ dở.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '';
    if (incoming !== current && !editor.isFocused) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return <div className="tvl-input" style={{ minHeight }} />;
  }

  const btnClass = (active: boolean) =>
    `tvl-rte-btn${active ? ' tvl-rte-btn-active' : ''}`;

  return (
    <div className="tvl-richtext">
      <div className="tvl-richtext-toolbar">
        <button
          type="button"
          title="In đậm"
          className={btnClass(editor.isActive('bold'))}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <b>B</b>
        </button>
        <button
          type="button"
          title="In nghiêng"
          className={btnClass(editor.isActive('italic'))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <i>I</i>
        </button>
        <button
          type="button"
          title="Gạch chân"
          className={btnClass(editor.isActive('underline'))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </button>
        <span className="tvl-rte-divider" />
        <button
          type="button"
          title="Danh sách gạch đầu dòng"
          className={btnClass(editor.isActive('bulletList'))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • ⁃
        </button>
        <button
          type="button"
          title="Danh sách đánh số"
          className={btnClass(editor.isActive('orderedList'))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.2.
        </button>
        <span className="tvl-rte-divider" />
        <button
          type="button"
          title="Xoá định dạng"
          className="tvl-rte-btn"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          ⨯ Aa
        </button>
      </div>
      <div className="tvl-richtext-editor-wrap" style={{ minHeight, maxHeight: 640 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
