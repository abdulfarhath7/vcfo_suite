import { describe, expect, it } from 'vitest';

import {

  parseBoardResolutionPatchContent,

  parseFormattedLine,

  patchDocumentBodyParagraphs,

  patchParagraphText,

  serializeBoardResolutionPatchContent,

  splitBoardResolutionContent,

} from '@/lib/board-resolution-docx-body';



describe('splitBoardResolutionContent', () => {

  it('splits on newlines', () => {

    expect(splitBoardResolutionContent('Line one\nLine two')).toEqual(['Line one', 'Line two']);

  });



  it('normalizes CRLF', () => {

    expect(splitBoardResolutionContent('A\r\nB')).toEqual(['A', 'B']);

  });

});



describe('patchParagraphText', () => {

  it('preserves paragraph alignment and replaces text runs only', () => {

    const para =

      '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>' +

      '<w:r><w:rPr><w:b/></w:rPr><w:t>Title</w:t></w:r></w:p>';

    const patched = patchParagraphText(para, 'New title');

    expect(patched).toContain('<w:jc w:val="center"/>');

    expect(patched).toContain('<w:t>New title</w:t>');

    expect(patched).not.toContain('>Title<');

  });



  it('creates separate runs for inline bold segments', () => {

    const para = '<w:p><w:r><w:t>Hello world</w:t></w:r></w:p>';

    const patched = patchParagraphText(para, 'Hello <strong>world</strong>');

    expect(patched).toContain('<w:t xml:space="preserve">Hello </w:t>');

    expect(patched).toContain('<w:b/>');

    expect(patched).toContain('<w:t>world</w:t>');

  });



  it('removes bold from non-bold segments when base run is bold', () => {

    const para = '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>All bold</w:t></w:r></w:p>';

    const patched = patchParagraphText(para, 'Bold <strong>only</strong> here');

    expect(patched.match(/<w:b[\s/>]/g)?.length).toBe(1);

    expect(patched).toContain('<w:t xml:space="preserve">Bold </w:t>');

    expect(patched).toContain('<w:t>only</w:t>');

    expect(patched).toContain('<w:t xml:space="preserve"> here</w:t>');

  });



  it('applies explicit paragraph alignment from structured patches', () => {

    const para = '<w:p><w:r><w:t>Title</w:t></w:r></w:p>';

    const patched = patchParagraphText(para, { text: 'Title', align: 'center' });

    expect(patched).toContain('<w:jc w:val="center"/>');

  });



  it('overrides existing alignment when left is applied explicitly', () => {

    const para =

      '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>';

    const patched = patchParagraphText(para, { text: 'Title', align: 'left' });

    expect(patched).toContain('<w:jc w:val="left"/>');

    expect(patched).not.toContain('w:val="center"');

  });



  it('does not duplicate xml:space when source run already has preserve', () => {

    const para =

      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">THE FOLLOWING </w:t></w:r></w:p>';

    const patched = patchParagraphText(para, 'THE FOLLOWING text');

    expect(patched).not.toMatch(/xml:space="preserve"[^>]*xml:space="preserve"/);

    expect((patched.match(/xml:space="preserve"/g) ?? []).length).toBeLessThanOrEqual(1);

  });

  it('preserves tab-only runs and replaces text runs in paragraphs with pPr rPr', () => {
    const para =
      '<w:p><w:pPr><w:spacing w:after="0"/>' +
      '<w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:tab/></w:r>' +
      '<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r></w:p>';

    const patched = patchParagraphText(para, 'Signature line');

    expect(patched).toContain('<w:t>Signature line</w:t>');
    expect(patched).toContain('<w:tab/>');
    expect(patched.match(/<\/w:pPr>/g)?.length ?? 0).toBe(1);
    expect(patched).not.toMatch(/<w:tab\/>Signature line<\/w:t>/);
  });

  it('does not treat w:tab as a text node when reading run attrs', () => {
    const para =
      '<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:tab/></w:r>' +
      '<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>Existing</w:t></w:r></w:p>';

    const patched = patchParagraphText(para, 'Replacement');

    expect(patched).toContain('<w:t>Replacement</w:t>');
    expect(patched).not.toMatch(/<w:tab\/>Replacement<\/w:t>/);
  });

});



describe('parseFormattedLine', () => {

  it('parses strong tags into segments', () => {

    expect(parseFormattedLine('A <strong>B</strong> C')).toEqual([

      { text: 'A ', bold: false },

      { text: 'B', bold: true },

      { text: ' C', bold: false },

    ]);

  });

});



describe('serializeBoardResolutionPatchContent', () => {

  it('uses inline strong markers for bold-only drafts', () => {

    const serialized = serializeBoardResolutionPatchContent([

      { text: 'Hello world', line: 'Hello <strong>world</strong>' },

    ]);

    expect(serialized).toBe('Hello <strong>world</strong>');

  });



  it('uses structured JSON when alignment is present', () => {

    const serialized = serializeBoardResolutionPatchContent([

      { text: 'Centered title', align: 'center' },

    ]);

    expect(serialized.startsWith('{"br":')).toBe(true);

    expect(parseBoardResolutionPatchContent(serialized)[0]?.align).toBe('center');

  });

});



describe('patchDocumentBodyParagraphs', () => {

  const sampleXml =

    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +

    '<w:body>' +

    '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>' +

    '<w:p><w:r><w:t>Body</w:t></w:r></w:p>' +

    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>' +

    '</w:body></w:document>';



  it('replaces paragraph text while preserving sectPr', () => {

    const updated = patchDocumentBodyParagraphs(sampleXml, 'New title\nNew body');

    expect(updated).toContain('<w:t>New title</w:t>');

    expect(updated).toContain('<w:t>New body</w:t>');

    expect(updated).toContain('<w:sectPr>');

    expect(updated).not.toContain('>Title<');

    expect(updated).not.toContain('>Body<');

  });



  it('preserves paragraph properties from source paragraph', () => {

    const updated = patchDocumentBodyParagraphs(sampleXml, 'New title\nNew body');

    expect(updated).toContain('<w:jc w:val="center"/>');

  });



  it('leaves extra paragraphs unchanged when preview has fewer lines', () => {

    const updated = patchDocumentBodyParagraphs(sampleXml, 'Only one line');

    expect(updated).toContain('<w:t>Only one line</w:t>');

    expect(updated).toContain('<w:t>Body</w:t>');

  });



  it('applies alignment from structured JSON content', () => {

    const content = serializeBoardResolutionPatchContent([

      { text: 'Center title', align: 'center' },

      { text: 'Body line' },

    ]);

    const updated = patchDocumentBodyParagraphs(sampleXml, content);

    expect(updated).toContain('<w:jc w:val="center"/>');

    expect(updated).toContain('<w:t>Center title</w:t>');

    expect(updated).toContain('<w:t>Body line</w:t>');

  });



  it('parseBoardResolutionPatchContent reads structured JSON', () => {

    const content = JSON.stringify({

      br: 1,

      paragraphs: [{ text: 'A', align: 'right' }, { text: 'B' }],

    });

    expect(parseBoardResolutionPatchContent(content)).toEqual([

      { text: 'A', line: undefined, align: 'right' },

      { text: 'B', line: undefined, align: undefined },

    ]);

  });



  it('dedupes duplicate xml:space on patched template-like paragraphs', () => {

    const templatePara =

      '<w:p><w:pPr><w:jc w:val="both"/></w:pPr>' +

      '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">RESOLVED THAT </w:t></w:r>' +

      '<w:r><w:rPr><w:b/></w:rPr><w:t>text</w:t></w:r></w:p>';

    const xml =

      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +

      '<w:body>' +

      templatePara +

      '<w:sectPr/></w:body></w:document>';

    const updated = patchDocumentBodyParagraphs(

      xml,

      'RESOLVED THAT <strong>text</strong> here',

    );

    expect(updated).not.toMatch(/xml:space="preserve"[^>]*xml:space="preserve"/);

  });

  it('does not treat w:rPr inside w:pPr as a preserved text run', () => {
    const tabParagraph =
      '<w:p><w:pPr><w:spacing w:after="0"/>' +
      '<w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:pPr>' +
      '<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:tab/></w:r>' +
      '<w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r></w:p>';
    const xml =
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      tabParagraph +
      '<w:sectPr/></w:body></w:document>';

    const updated = patchDocumentBodyParagraphs(xml, 'Signature line');

    expect(updated).toContain('<w:t>Signature line</w:t>');
    expect(updated.match(/<\/w:pPr>/g)?.length ?? 0).toBe(1);
    expect(updated).not.toMatch(/<\/w:pPr>\s*<w:rPr>[\s\S]*?<\/w:rPr>\s*<\/w:pPr>/);
  });

});


