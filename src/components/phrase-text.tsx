/**
 * Thai has no spaces between words, so browsers may wrap a headline in the
 * middle of a phrase ("สิทธิของ / เรา"). Mark safe break points with "|" and
 * each phrase stays on one line. A space before "|" is kept as a real space.
 *
 *   <PhraseText text="เรียนรู้ ดูแลตัวเอง|และเคารพ|ในสิทธิ์ของเรา" />
 */
export function PhraseText({ text }: { text: string }) {
  if (!text.includes("|")) return <>{text}</>;
  const parts = text.split("|");
  return (
    <>
      {parts.map((part, i) => {
        const trailingSpace = part.endsWith(" ");
        return (
          <span key={i}>
            <span className="inline-block">{part.trim()}</span>
            {trailingSpace && i < parts.length - 1 ? " " : null}
          </span>
        );
      })}
    </>
  );
}
