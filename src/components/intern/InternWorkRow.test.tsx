/** @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InternWorkDenseLayout } from '@/components/intern/InternWorkDenseLayout';

describe('InternWorkDenseLayout', () => {
  it('keeps status and age as wrap siblings and puts the action on its own flex row', () => {
    const { container } = render(
      <InternWorkDenseLayout
        title="Advance Tax Payment Q2"
        subtitle="ABC India"
        status={<span>Waiting manager</span>}
        age={<span>1 hr</span>}
        action={<button type="button">Email manager again</button>}
      />,
    );

    const meta = container.querySelector('.intern-work-dense-meta') as HTMLElement | null;
    const status = container.querySelector('.intern-work-dense-status') as HTMLElement | null;
    const age = container.querySelector('.intern-work-dense-age') as HTMLElement | null;
    const cta = container.querySelector('.intern-work-dense-cta') as HTMLElement | null;

    expect(meta).toBeTruthy();
    expect(status).toBeTruthy();
    expect(age).toBeTruthy();
    expect(cta).toBeTruthy();
    expect(meta).toContainElement(status);
    expect(meta).toContainElement(age);
    expect(meta).toContainElement(cta);
    expect(status!.compareDocumentPosition(age!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(age!.compareDocumentPosition(cta!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
