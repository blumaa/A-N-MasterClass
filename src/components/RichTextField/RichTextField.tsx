'use client';
// Rich text form field: TipTap editor plus a hidden input carrying the document as JSON, so any
// ActionForm posts it like a plain field (server: parseDoc). Ported from KSG ArticleEditor.
import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button, Icon, Input, useFieldContext } from '@/components/ui/mds';
import { emptyDoc, type Doc } from '@/lib/doc/doc';
import styles from './RichTextField.module.css';

// What a writer can draw; DocBody renders exactly this set.
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
];

type Format = 'heading2' | 'heading3' | 'bold' | 'italic' | 'bulletList' | 'orderedList' | 'blockquote';

const FORMATS: readonly { format: Format; label: string; icon: string; run: (e: Editor) => void }[] = [
  { format: 'heading2', label: 'Heading', icon: 'heading-2', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { format: 'heading3', label: 'Subheading', icon: 'heading-3', run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { format: 'bold', label: 'Bold', icon: 'bold', run: (e) => e.chain().focus().toggleBold().run() },
  { format: 'italic', label: 'Italic', icon: 'italic', run: (e) => e.chain().focus().toggleItalic().run() },
  { format: 'bulletList', label: 'Bulleted list', icon: 'list', run: (e) => e.chain().focus().toggleBulletList().run() },
  { format: 'orderedList', label: 'Numbered list', icon: 'list-ordered', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { format: 'blockquote', label: 'Quote', icon: 'text-quote', run: (e) => e.chain().focus().toggleBlockquote().run() },
];

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** A typed address as a link: https unless it names a scheme. */
export const asHref = (typed: string): string => {
  const trimmed = typed.trim();
  return SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
};

function Toolbar({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState<string | null>(null);
  const on = useEditorState({
    editor,
    selector: ({ editor: e }): Record<Format | 'link', boolean> => ({
      heading2: e.isActive('heading', { level: 2 }),
      heading3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      link: e.isActive('link'),
    }),
  });

  const pressLink = () => {
    if (on.link) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else setLinking(linking === null ? '' : null);
  };

  const setLink = () => {
    if (linking === null || linking.trim() === '') return;
    const href = asHref(linking);
    // Nothing selected: the address becomes the words, and the mark stops after them.
    if (editor.state.selection.empty)
      editor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: linking.trim(), marks: [{ type: 'link', attrs: { href } }] })
        .unsetMark('link')
        .run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setLinking(null);
  };

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
      {FORMATS.map(({ format, label, icon, run }) => (
        <Button
          key={format}
          type="button"
          variant={on[format] ? 'secondary' : 'ghost'}
          size="sm"
          iconOnly
          aria-label={label}
          aria-pressed={on[format]}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => run(editor)}
        >
          <Icon name={icon} />
        </Button>
      ))}
      <Button
        type="button"
        variant={on.link ? 'secondary' : 'ghost'}
        size="sm"
        iconOnly
        aria-label={on.link ? 'Remove link' : 'Link'}
        aria-pressed={on.link}
        onMouseDown={(event) => event.preventDefault()}
        onClick={pressLink}
      >
        <Icon name="link" />
      </Button>
      {/* A div, not a form: the field already sits in one. Enter adds the link, not submits. */}
      {linking === null ? null : (
        <div className={styles.linkForm}>
          <Input
            aria-label="Link address"
            placeholder="https://"
            value={linking}
            autoFocus
            onChange={(event) => setLinking(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setLinking(null);
              if (event.key === 'Enter') {
                event.preventDefault();
                setLink();
              }
            }}
          />
          <Button type="button" variant="secondary" size="sm" disabled={linking.trim() === ''} onClick={setLink}>
            Add link
          </Button>
        </div>
      )}
    </div>
  );
}

// label: MDS Field's <label for> cannot name a contenteditable div and has no id for
// aria-labelledby, so the editor carries its name itself.
type Props = { name: string; label: string; defaultValue: Doc | null; placeholder?: string };

export function RichTextField({ name, label, defaultValue, placeholder = 'Write here…' }: Props) {
  const field = useFieldContext();
  const [doc, setDoc] = useState<Doc>(defaultValue ?? emptyDoc());
  const editor = useEditor({
    extensions: [...EXTENSIONS, Placeholder.configure({ placeholder })],
    content: doc,
    // Server rendered: the editor mounts on the client only (TipTap SSR guidance).
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        ...(field === null ? {} : { id: field.id }),
        ...(field?.describedBy === undefined ? {} : { 'aria-describedby': field.describedBy }),
        ...(field?.invalid ? { 'aria-invalid': 'true' } : {}),
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': 'true',
        class: styles.content ?? '',
      },
    },
    onUpdate: ({ editor: e }) => setDoc(e.getJSON() as Doc),
  });

  return (
    <div className={styles.editor}>
      <input type="hidden" name={name} value={JSON.stringify(doc)} />
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}
