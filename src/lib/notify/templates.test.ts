import { describe, expect, it } from 'vitest';
import {
  buildTemplateComponents,
  firstNameOf,
  readTemplateNames,
  templateNameEnvKey,
} from '@/lib/notify/templates';
import { NOTIFY_EVENTS } from '@/lib/notify/types';

/**
 * `orderedVariables` is the single source of truth for each template body;
 * these tests pin the order and the sanitising the Meta payload relies on.
 */

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe('template references', () => {
  it('derives the override env key from the event name', () => {
    expect(templateNameEnvKey('compliance_due_monthly')).toBe(
      'WHATSAPP_TEMPLATE_NAME_COMPLIANCE_DUE_MONTHLY',
    );
  });

  it('defaults every Meta template name to the event name', () => {
    const names = readTemplateNames(env({}));
    for (const event of NOTIFY_EVENTS) expect(names[event]).toBe(event);
  });

  it('honours an override but treats a blank one as a typo', () => {
    expect(readTemplateNames(env({ WHATSAPP_TEMPLATE_NAME_WELCOME: 'vcfo_welcome_v2' })).welcome)
      .toBe('vcfo_welcome_v2');
    expect(readTemplateNames(env({ WHATSAPP_TEMPLATE_NAME_WELCOME: '   ' })).welcome).toBe(
      'welcome',
    );
  });
});

describe('variable serialisation', () => {
  const vars = {
    firstName: 'Asha',
    companyName: 'Kestrel Robotics India Pvt Ltd',
    obligationName: 'GSTR-3B',
    dueDate: '20 Apr 2026',
    stepTitle: 'Certificate of Incorporation',
  };

  it('emits one body component of text parameters for every event', () => {
    for (const event of NOTIFY_EVENTS) {
      const components = buildTemplateComponents(event, vars);
      expect(components).toHaveLength(1);
      expect(components[0]!.type).toBe('body');
      for (const parameter of components[0]!.parameters) {
        expect(parameter.type).toBe('text');
        expect(parameter.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('orders the compliance body company → obligation → due date', () => {
    expect(buildTemplateComponents('compliance_due_monthly', vars)).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Kestrel Robotics India Pvt Ltd' },
          { type: 'text', text: 'GSTR-3B' },
          { type: 'text', text: '20 Apr 2026' },
        ],
      },
    ]);
  });

  it('collapses whitespace and clamps long values', () => {
    const messy = { companyName: `  Kestrel\n\n  Robotics  ${'x'.repeat(200)}  ` };
    const [component] = buildTemplateComponents('coi_issued', messy);
    const text = component!.parameters[0]!.text;
    expect(text.startsWith('Kestrel Robotics x')).toBe(true);
    expect(text).toHaveLength(120);
  });

  it('substitutes an empty string for a missing variable rather than dropping it', () => {
    expect(buildTemplateComponents('document_delivered', { companyName: 'Acme' })).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Acme' },
          { type: 'text', text: '' },
        ],
      },
    ]);
  });
});

describe('firstNameOf', () => {
  it('takes the first token and falls back to a neutral greeting', () => {
    expect(firstNameOf('Asha Rao')).toBe('Asha');
    expect(firstNameOf('  Asha   Rao ')).toBe('Asha');
    expect(firstNameOf('')).toBe('there');
    expect(firstNameOf(null)).toBe('there');
  });
});
