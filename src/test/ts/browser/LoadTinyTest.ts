/* eslint-disable @typescript-eslint/no-unused-vars */
import { Assertions, Waiter } from '@ephox/agar';
import { after, beforeEach, context, describe, it } from '@ephox/bedrock-client';
import { Arr, Global, Strings } from '@ephox/katamari';
import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { Attribute, Remove, SelectorFilter, SugarElement } from '@ephox/sugar';

import { VERSIONS, type Version } from '../alien/TestHelpers';
import { cleanAllEngines, render } from '../alien/Loader';
import { Editor, IAllProps } from '../../../main/ts/components/Editor';
import { ScriptLoader } from 'src/main/ts/ScriptLoader2';

const EDITOR42_LOCAL = '/project/node_modules/editor42/editor42.min.js';

const assertTinymceVersion = (version: Version) => {
  Assertions.assertEq(`Loaded version of TinyMCE should be ${version}`, version, Global.tinymce.majorVersion);
};

const assertEditor42 = () => {
  Assertions.assertEq('Loaded engine should be editor42', true, Global.editor42.minorVersion.startsWith('42.'));
};

export const deleteTinymce = () => {
  ScriptLoader.reinitialize();
  cleanAllEngines();

  const hasEngineUri = (attrName: string) => (elm: SugarElement<Element>) =>
    Attribute.getOpt(elm, attrName).exists((src) =>
      Strings.contains(src, 'tinymce') || Strings.contains(src, 'editor42'));

  const elements = Arr.flatten([
    Arr.filter(SelectorFilter.all('script'), hasEngineUri('src')),
    Arr.filter(SelectorFilter.all('link'), hasEngineUri('href')),
  ]);

  Arr.each(elements, Remove.remove);
};

const currentScriptSrcs = (): string[] =>
  Array.from(document.querySelectorAll<HTMLScriptElement>('script'))
    .map((s) => s.getAttribute('src') ?? '')
    .filter((s) => s.length > 0);

// Mount without waiting for the editor: the fallback URL points at the real CDN, which
// this environment never reaches. Returns the script srcs the component injected.
const pMountAndCollectScriptSrcs = async (props: IAllProps): Promise<string[]> => {
  const before = currentScriptSrcs();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);
  root.render(React.createElement('div', {}, React.createElement(Editor, props)));
  let added: string[] = [];
  await Waiter.pTryUntil('a script tag was injected', () => {
    added = Arr.filter(currentScriptSrcs(), (s) => !Arr.contains(before, s));
    if (added.length === 0) {
      throw new Error('no new script tag yet');
    }
  });
  root.unmount();
  container.remove();
  return added;
};

describe('LoadTinyTest', () => {
  beforeEach(() => {
    deleteTinymce();
  });

  after(() => {
    deleteTinymce();
  });

  context('local engine loading', () => {
    it('Should be able to load a local editor42 build using the editor42ScriptSrc prop', async () => {
      using _ = await render({ editor42ScriptSrc: EDITOR42_LOCAL });
      assertEditor42();
    });

    it('editor42ScriptSrc wins over the deprecated tinymceScriptSrc alias', async () => {
      using _ = await render({
        editor42ScriptSrc: EDITOR42_LOCAL,
        tinymceScriptSrc: '/project/node_modules/tinymce-6/tinymce.min.js'
      });
      assertEditor42();
    });

    it('Should support an array of script items (hybrid mode)', async () => {
      using _ = await render({ editor42ScriptSrc: [{ src: EDITOR42_LOCAL }] });
      assertEditor42();
    });

    VERSIONS.forEach((version) => {
      it(`Should be able to load local version (${version}) of TinyMCE using the tinymceScriptSrc prop`, async () => {
        using _ = await render({ tinymceScriptSrc: `/project/node_modules/tinymce-${version}/tinymce.min.js` });
        assertTinymceVersion(version);
      });
    });
  });

  context('cdn fallback', () => {
    const expectUrl = (channel: string) => `https://cdn.editor42.com/editor42/${channel}/editor42.min.js`;

    it('falls back to the latest channel with no props at all', async () => {
      const srcs = await pMountAndCollectScriptSrcs({});
      Assertions.assertEq('exactly the latest channel url', [ expectUrl('latest') ], srcs);
    });

    it('the channel prop selects the cdn path', async () => {
      Assertions.assertEq('exact version', [ expectUrl('42.0.0') ],
        await pMountAndCollectScriptSrcs({ channel: '42.0.0' }));
      Assertions.assertEq('latest-N alias', [ expectUrl('latest-14') ],
        await pMountAndCollectScriptSrcs({ channel: 'latest-14' }));
    });

    it('legacy cloudChannel values map to latest', async () => {
      Assertions.assertEq('tinymce channel mapped', [ expectUrl('latest') ],
        await pMountAndCollectScriptSrcs({ cloudChannel: '7' }));
    });

    it('never contacts tiny.cloud and never sends a key, whatever key props are set', async () => {
      const srcs = await pMountAndCollectScriptSrcs({ apiKey: 'a-fake-api-key', licenseKey: 'gpl', cloudChannel: '7' });
      Assertions.assertEq('exactly the editor42 cdn url', [ expectUrl('latest') ], srcs);
      Arr.each(srcs, (src) => {
        Assertions.assertEq('no tiny.cloud contact', false, Strings.contains(src, 'tiny.cloud'));
        Assertions.assertEq('no key in the url', false,
          Strings.contains(src, 'a-fake-api-key') || Strings.contains(src, 'no-api-key'));
      });
    });
  });

  context('script loading options', () => {
    it('an empty editor42ScriptSrc array opts out of loading and reports it', async () => {
      const message = await new Promise<string>((resolve) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = ReactDOMClient.createRoot(container);
        root.render(React.createElement('div', {}, React.createElement(Editor, {
          editor42ScriptSrc: [],
          onScriptsLoadError: (err: unknown) => {
            resolve(err instanceof Error ? err.message : String(err));
            setTimeout(() => {
              root.unmount();
              container.remove();
            }, 0);
          }
        })));
      });
      Assertions.assertEq('opt-out error message',
        'No editor42 (or tinymce) global is present but the `editor42ScriptSrc` prop was an empty array.', message);
    });

    it('passes integrity and crossOrigin through to the injected tag', async () => {
      const sriSrc = `${EDITOR42_LOCAL}?sri-probe`;
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOMClient.createRoot(container);
      root.render(React.createElement('div', {}, React.createElement(Editor, {
        editor42ScriptSrc: [{ src: sriSrc, integrity: 'sha384-bogus', crossOrigin: 'anonymous' }]
      })));
      await Waiter.pTryUntil('sri script tag appears', () => {
        if (document.querySelector(`script[src="${sriSrc}"]`) === null) {
          throw new Error('tag not injected yet');
        }
      });
      const tag = document.querySelector(`script[src="${sriSrc}"]`) as HTMLScriptElement;
      Assertions.assertEq('integrity attribute set', 'sha384-bogus', tag.integrity);
      Assertions.assertEq('crossorigin attribute set', 'anonymous', tag.crossOrigin);
      root.unmount();
      container.remove();
    });
  });
});
