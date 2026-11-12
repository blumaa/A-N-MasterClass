// Rich text as the reader sees it: the stored document walked once, only known nodes and marks
// drawn. Ported from KSG DocBody (no media, no mentions here).
import { Fragment, type ReactNode } from 'react';
import { Heading, Link, Text } from '@/components/ui/mds';
import type { Doc, DocMark, DocNode } from '@/lib/doc/doc';
import styles from './DocBody.module.css';

// Only http(s) leaves the document as a link; anything else stays words.
const SAFE_HREF = /^https?:\/\/[^\s]+$/i;

const hrefOf = (mark: DocMark): string | null => {
  const href = mark.attrs?.href;
  return typeof href === 'string' && SAFE_HREF.test(href) ? href : null;
};

const levelOf = (node: DocNode): 2 | 3 => (node.attrs?.level === 3 ? 3 : 2);

function marked(text: string, marks: readonly DocMark[]): ReactNode {
  let out: ReactNode = text;
  for (const mark of marks) {
    if (mark.type === 'bold') out = <strong>{out}</strong>;
    else if (mark.type === 'italic') out = <em>{out}</em>;
    else if (mark.type === 'link') {
      const href = hrefOf(mark);
      if (href !== null)
        out = (
          <Link href={href} external>
            {out}
          </Link>
        );
    }
  }
  return out;
}

function Inlines({ nodes }: { nodes: readonly DocNode[] }) {
  return nodes.map((node, i) => {
    if (node.type === 'text') return <Fragment key={i}>{marked(node.text ?? '', node.marks ?? [])}</Fragment>;
    if (node.type === 'hardBreak') return <br key={i} />;
    return null;
  });
}

function Block({ node }: { node: DocNode }) {
  const children = node.content ?? [];
  switch (node.type) {
    case 'paragraph':
      return (
        <Text as="p">
          <Inlines nodes={children} />
        </Text>
      );
    case 'heading':
      return (
        <Heading level={levelOf(node)}>
          <Inlines nodes={children} />
        </Heading>
      );
    case 'blockquote':
      return (
        <blockquote className={styles.quote}>
          <Blocks nodes={children} />
        </blockquote>
      );
    case 'bulletList':
    case 'orderedList': {
      const List = node.type === 'bulletList' ? 'ul' : 'ol';
      return (
        <List className={styles.list}>
          {children.map((item, i) => (
            <li key={i}>
              <Blocks nodes={item.content ?? []} />
            </li>
          ))}
        </List>
      );
    }
    default:
      return null;
  }
}

function Blocks({ nodes }: { nodes: readonly DocNode[] }) {
  return nodes.map((node, i) => <Block key={i} node={node} />);
}

export function DocBody({ doc }: { doc: Doc }) {
  return (
    <div className={styles.doc}>
      <Blocks nodes={doc.content ?? []} />
    </div>
  );
}
