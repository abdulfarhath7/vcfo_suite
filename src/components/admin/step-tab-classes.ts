/* Underline tabs (VCFO Spectrum R-11, N4) for the views of one step: Forms, Documents and
   Activity switch in place (R-36). A 2px blurple underline marks the picked tab. Used on the
   Radix `TabsList` and `TabsTrigger` so the tab logic stays as it was. */
export const UNDERLINE_TAB_LIST =
  'mb-4 flex h-auto w-full justify-start gap-5 rounded-none border-b-1.5 border-line bg-transparent p-0';

export const UNDERLINE_TAB_TRIGGER =
  '-mb-[1.5px] h-10 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 text-[14px] font-medium text-ink-muted transition-colors hover:text-ink data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:text-ink data-[state=active]:shadow-none';
