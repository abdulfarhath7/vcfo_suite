import { describe, expect, it } from 'vitest';
import {
  buildContentVariables,
  buildTemplateComponents,
  firstNameOf,
  readTemplateNames,
  readTemplateSids,
  templateEnvKey,
  templateNameEnvKey,
} from '@/lib/notify/templates';
import { NOTIFY_EVENTS } from '@/lib/notify/types';

/**
 * Both providers serialise the SAME ordered values. These tests exist to keep
 * that true: if a template body ever gained a variable on one path only, the
 * two builders would disagree here.
 */

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe('template references', () => {
  it('keeps the Twilio SID and the Meta name on separate env keys', () => {
    expect(templateEnvKey('compliance_due_monthly')).toBe(
      'WHATSAPP_TEMPLATE_COMPLIANCE_DUE_MONTHLY',
    );
    expect(templateNameEnvKey('compliance_due_monthly')).toBe(
      'WHATSAPP_TEMPLATE_NAME_COMPLIANCE_DUE_MONTHLY',
    );
  });

  it('reads Twilio SIDs only where configured', () => {
    expect(readTemplateSids(env({}))).toEqual({});
    expect(readTemplateSids(env({ WHATSAPP_TEMPLATE_WELCOME: '  HX1  ' }))).toEqual({
      welcome: 'HX1',
    });
    expect(readTemplateSids(env({ WHATSAPP_TEMPLATE_WELCOME: '   ' }))).toEqual({});
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

  it('agrees between the Twilio and Meta builders for every event', () => {
    for (const event of NOTIFY_EVENTS) {
      const positional = JSON.parse(buildContentVariables(event, vars)) as Record<string, string>;
      const components = buildTemplateComponents(event, vars);
      const metaValues = components[0]?.parameters.map((p) => p.text) ?? [];
      expect(metaValues).toEqual(Object.values(positional));
      expect(Object.keys(positional)).toEqual(
        metaValues.map((_, index) => String(index + 1)),
      );
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

  it('collapses whitespace and clamps long values on both paths', () => {
    const messy = { companyName: `  Kestrel\n\n  Robotics  ${'x'.repeat(200)}  ` };
    const [component] = buildTemplateComponents('coi_issued', messy);
    const text = component!.parameters[0]!.text;
    expect(text.startsWith('Kestrel Robotics x')).toBe(true);
    expect(text).toHaveLength(120);
    expect(JSON.parse(buildContentVariables('coi_issued', messy))['1']).toBe(text);
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
