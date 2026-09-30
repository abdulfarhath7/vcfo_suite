/** D1: the user's own message is neutral, never primary blue. */
export function AskUserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-muted px-3 py-2 text-[13.5px] text-foreground">
        {text}
      </p>
    </div>
  );
}
