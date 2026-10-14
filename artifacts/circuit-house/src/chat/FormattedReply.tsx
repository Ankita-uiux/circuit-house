import { Fragment, type ReactNode } from 'react';

/** Renders the assistant's plain-text reply: paragraphs, "- " bullet lists, numbered lists and **bold**. */
export function FormattedReply({ text, sources = [] }: { text: string; sources?: Array<{ title: string; url: string }> }) {
  const inline = (value: string) => renderInline(value, sources);
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const bullet = /^[-•*]\s+/;
        const numbered = /^\d+[.)]\s+/;
        if (lines.every((line) => bullet.test(line))) {
          return <ul key={blockIndex}>{lines.map((line, i) => <li key={i}>{inline(line.replace(bullet, ''))}</li>)}</ul>;
        }
        if (lines.every((line) => numbered.test(line))) {
          return <ol key={blockIndex}>{lines.map((line, i) => <li key={i}>{inline(line.replace(numbered, ''))}</li>)}</ol>;
        }
        const firstBullet = lines.findIndex((line) => bullet.test(line));
        if (firstBullet > 0 && lines.slice(firstBullet).every((line) => bullet.test(line))) {
          return (
            <Fragment key={blockIndex}>
              <p>{lines.slice(0, firstBullet).map((line, i) => <Fragment key={i}>{i > 0 && ' '}{inline(line)}</Fragment>)}</p>
              <ul>{lines.slice(firstBullet).map((line, i) => <li key={i}>{inline(line.replace(bullet, ''))}</li>)}</ul>
            </Fragment>
          );
        }
        return <p key={blockIndex}>{lines.map((line, i) => <Fragment key={i}>{i > 0 && <br />}{inline(line)}</Fragment>)}</p>;
      })}
    </>
  );
}

function renderInline(text: string, sources: Array<{ title: string; url: string }> = []): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const source = /^\[\d+\]$/.test(part) ? sources[Number(part.slice(1, -1)) - 1] : undefined;
    return source ? <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} className="assistant-citation">{part}</a> : <Fragment key={i}>{part}</Fragment>;
  });
}
