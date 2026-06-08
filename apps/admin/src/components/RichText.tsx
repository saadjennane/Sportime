import { useRef, useEffect } from 'react';
import { Bold, Italic, List, ListOrdered, Heading } from 'lucide-react';

/** Lightweight WYSIWYG (contentEditable + execCommand) — outputs HTML, no deps. */
export function RichText({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || '';
  }, []); // init only

  const cmd = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    ref.current?.focus();
    onChange(ref.current?.innerHTML ?? '');
  };

  const Btn = ({ c, arg, children, title }: { c: string; arg?: string; children: React.ReactNode; title: string }) => (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); cmd(c, arg); }}
      className="p-1.5 rounded text-text-secondary hover:bg-background-dark hover:text-text-primary">{children}</button>
  );

  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border-subtle bg-background-dark">
        <Btn c="bold" title="Bold"><Bold size={15} /></Btn>
        <Btn c="italic" title="Italic"><Italic size={15} /></Btn>
        <Btn c="formatBlock" arg="<h3>" title="Heading"><Heading size={15} /></Btn>
        <Btn c="insertUnorderedList" title="Bullet list"><List size={15} /></Btn>
        <Btn c="insertOrderedList" title="Numbered list"><ListOrdered size={15} /></Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        data-placeholder={placeholder || 'Write the rules…'}
        className="min-h-[120px] max-h-[300px] overflow-y-auto px-3 py-2 text-sm text-text-primary focus:outline-none rt-editor"
      />
    </div>
  );
}
