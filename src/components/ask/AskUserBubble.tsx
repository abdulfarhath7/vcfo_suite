/** D1: the user's own message is the navy "strong" fill (prototype AskThread), never the blurple main colour. */
export function AskUserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-md bg-navy px-3 py-2 text-[13px] text-on-navy">{text}</p>
    </div>
  );
}
