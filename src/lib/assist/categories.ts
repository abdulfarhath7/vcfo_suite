const CATEGORY_LABEL: Record<string, string> = {
  incorporation: 'Incorporation',
  tax: 'Tax',
  'foreign-investment': 'Foreign investment',
  labour: 'Labour',
  compliance: 'Compliance',
  'your-project': 'Your project',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}
