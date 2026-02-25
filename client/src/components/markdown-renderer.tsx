import { Fragment } from "react";

function renderInlineMarkdown(text: string): (string | JSX.Element)[] {
  const result: (string | JSX.Element)[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);
    const boldAltMatch = remaining.match(/__(.+?)__/);
    const italicAltMatch = remaining.match(/(?<!_)_([^_]+?)_(?!_)/);

    let earliest: { idx: number; len: number; content: string; type: "bold" | "italic" } | null = null;

    if (boldMatch && boldMatch.index !== undefined) {
      earliest = { idx: boldMatch.index, len: boldMatch[0].length, content: boldMatch[1], type: "bold" };
    }
    if (italicMatch && italicMatch.index !== undefined) {
      if (!earliest || italicMatch.index < earliest.idx) {
        earliest = { idx: italicMatch.index, len: italicMatch[0].length, content: italicMatch[1], type: "italic" };
      }
    }
    if (boldAltMatch && boldAltMatch.index !== undefined) {
      if (!earliest || boldAltMatch.index < earliest.idx) {
        earliest = { idx: boldAltMatch.index, len: boldAltMatch[0].length, content: boldAltMatch[1], type: "bold" };
      }
    }
    if (italicAltMatch && italicAltMatch.index !== undefined) {
      if (!earliest || italicAltMatch.index < earliest.idx) {
        earliest = { idx: italicAltMatch.index, len: italicAltMatch[0].length, content: italicAltMatch[1], type: "italic" };
      }
    }

    if (!earliest) {
      result.push(remaining);
      break;
    }

    if (earliest.idx > 0) {
      result.push(remaining.slice(0, earliest.idx));
    }

    if (earliest.type === "bold") {
      result.push(<strong key={key++}>{earliest.content}</strong>);
    } else {
      result.push(<em key={key++}>{earliest.content}</em>);
    }

    remaining = remaining.slice(earliest.idx + earliest.len);
  }

  return result;
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_]+?)_(?!_)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^---+$/gm, "")
    .replace(/^\*\*\*+$/gm, "");
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

  return (
    <div className={className}>
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();

        if (trimmed.startsWith("# ")) {
          return <h2 key={i} className="font-serif text-xl font-bold text-stone-800 mt-4 mb-3">{renderInlineMarkdown(trimmed.replace(/^#+\s*/, ""))}</h2>;
        }
        if (trimmed.startsWith("## ")) {
          return <h3 key={i} className="font-serif text-lg font-bold text-stone-800 mt-3 mb-2">{renderInlineMarkdown(trimmed.replace(/^#+\s*/, ""))}</h3>;
        }
        if (trimmed.startsWith("### ")) {
          return <h4 key={i} className="font-serif text-base font-bold text-stone-700 mt-3 mb-2">{renderInlineMarkdown(trimmed.replace(/^#+\s*/, ""))}</h4>;
        }
        if (trimmed.startsWith("#### ")) {
          return <h5 key={i} className="font-serif text-sm font-bold text-stone-700 mt-2 mb-1">{renderInlineMarkdown(trimmed.replace(/^#+\s*/, ""))}</h5>;
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split(/\n/).filter(l => l.trim());
          return (
            <ul key={i} className="list-disc pl-5 mb-3 space-y-1">
              {items.map((item, j) => (
                <li key={j} className="font-serif text-sm text-stone-700 leading-relaxed">
                  {renderInlineMarkdown(item.replace(/^[-*]\s*/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        if (/^\d+\.\s/.test(trimmed)) {
          const items = trimmed.split(/\n/).filter(l => l.trim());
          return (
            <ol key={i} className="list-decimal pl-5 mb-3 space-y-1">
              {items.map((item, j) => (
                <li key={j} className="font-serif text-sm text-stone-700 leading-relaxed">
                  {renderInlineMarkdown(item.replace(/^\d+\.\s*/, ""))}
                </li>
              ))}
            </ol>
          );
        }

        if (trimmed.startsWith(">")) {
          const quoteText = trimmed.split("\n").map(l => l.replace(/^>\s*/, "")).join(" ");
          return (
            <blockquote key={i} className="border-l-2 border-amber-700/30 pl-4 my-3 italic font-serif text-sm text-stone-600 leading-relaxed">
              {renderInlineMarkdown(quoteText)}
            </blockquote>
          );
        }

        if (trimmed === "---" || trimmed === "***" || /^[-*]{3,}$/.test(trimmed)) {
          return <div key={i} className="w-12 h-[1px] bg-stone-300 mx-auto my-4" />;
        }

        return (
          <p key={i} className="font-serif text-sm text-stone-700 leading-[1.9] mb-3 text-justify indent-6">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export function MarkdownRendererDark({ content, className }: MarkdownRendererProps) {
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

  return (
    <div className={className}>
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();

        if (trimmed.startsWith("# ")) {
          return <h2 key={i} className="text-base font-bold text-foreground/90 mt-3 mb-2">{renderInlineMarkdown(trimmed.replace(/^#+\s*/, ""))}</h2>;
        }
        if (trimmed.startsWith("## ")) {
          return <h3 key={i} className="text-sm font-bold text-foreground/80 mt-2.5 mb-1.5">{renderInlineMarkdown(trimmed.replace(/^#+\s*/, ""))}</h3>;
        }
        if (trimmed.startsWith("### ") || trimmed.startsWith("#### ")) {
          return <h4 key={i} className="text-sm font-semibold text-foreground/70 mt-2 mb-1">{renderInlineMarkdown(trimmed.replace(/^#+\s*/, ""))}</h4>;
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split(/\n/).filter(l => l.trim());
          return (
            <ul key={i} className="list-disc pl-4 mb-2 space-y-0.5">
              {items.map((item, j) => (
                <li key={j} className="text-sm text-muted-foreground/70 leading-relaxed">
                  {renderInlineMarkdown(item.replace(/^[-*]\s*/, ""))}
                </li>
              ))}
            </ul>
          );
        }

        if (/^\d+\.\s/.test(trimmed)) {
          const items = trimmed.split(/\n/).filter(l => l.trim());
          return (
            <ol key={i} className="list-decimal pl-4 mb-2 space-y-0.5">
              {items.map((item, j) => (
                <li key={j} className="text-sm text-muted-foreground/70 leading-relaxed">
                  {renderInlineMarkdown(item.replace(/^\d+\.\s*/, ""))}
                </li>
              ))}
            </ol>
          );
        }

        if (trimmed.startsWith(">")) {
          const quoteText = trimmed.split("\n").map(l => l.replace(/^>\s*/, "")).join(" ");
          return (
            <blockquote key={i} className="border-l-2 border-purple-500/30 pl-3 my-2 italic text-sm text-muted-foreground/60 leading-relaxed">
              {renderInlineMarkdown(quoteText)}
            </blockquote>
          );
        }

        if (trimmed === "---" || trimmed === "***" || /^[-*]{3,}$/.test(trimmed)) {
          return <div key={i} className="w-8 h-[1px] bg-border/30 mx-auto my-3" />;
        }

        return (
          <p key={i} className="text-sm text-muted-foreground/70 leading-relaxed mb-2">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
