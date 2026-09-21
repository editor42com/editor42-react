import { Assertions } from '@ephox/agar';
import { after, describe, it } from '@ephox/bedrock-client';
import { VersionLoader } from '@tinymce/miniature';

import { ScriptLoader } from '../../../main/ts/ScriptLoader2';
import { getEditor42OrError } from '../../../main/ts/Utils';
import { cleanAllEngines, cleanEditor42, pLoadEditor42, render } from '../alien/Loader';

// The four page states of the dual-engine contract, plus the shim-off run.
describe('DualEngineTest', () => {
  const w = window as any;

  after(() => {
    ScriptLoader.reinitialize();
    cleanAllEngines();
  });

  it('editor42 only: the wrapper drives editor42', async () => {
    await pLoadEditor42();
    using ctx = await render({});
    Assertions.assertEq('majorVersion is the TinyMCE 6 api level', '6', w.editor42.majorVersion);
    Assertions.assertEq('minorVersion is 42-family', true, w.editor42.minorVersion.startsWith('42.'));
    Assertions.assertEq('editor belongs to editor42', true, ctx.editor.editorManager === w.editor42);
  });

  it('editor42 with the shim disabled still works', async () => {
    await pLoadEditor42({ noShim: true });
    Assertions.assertEq('no tinymce alias with EDITOR42_NO_SHIM', undefined, w.tinymce);
    using ctx = await render({});
    Assertions.assertEq('editor belongs to editor42', true, ctx.editor.editorManager === w.editor42);
  });

  it('real tinymce only: the wrapper falls back', async () => {
    cleanEditor42();
    await VersionLoader.pLoadVersion('6');
    using ctx = await render({});
    Assertions.assertEq('no editor42 global', undefined, w.editor42);
    Assertions.assertEq('editor belongs to tinymce', true, ctx.editor.editorManager === w.tinymce);
  });

  it('both engines loaded: editor42 wins and tinymce is not clobbered', async () => {
    cleanEditor42();
    await VersionLoader.pLoadVersion('6');
    await pLoadEditor42();
    Assertions.assertEq('tinymce majorVersion is 6', '6', w.tinymce.majorVersion);
    Assertions.assertEq('tinymce is the real one, not the editor42 shim', false, w.tinymce.minorVersion.startsWith('42.'));
    using ctx = await render({});
    Assertions.assertEq('editor belongs to editor42', true, ctx.editor.editorManager === w.editor42);
  });

  it('neither engine: the resolver reports a clean error', () => {
    cleanEditor42();
    delete w.tinymce;
    delete w.tinyMCE;
    let message = '';
    try {
      getEditor42OrError(window);
    } catch (e) {
      message = (e as Error).message;
    }
    Assertions.assertEq('clean error', 'editor42 should have been loaded into global scope', message);
  });
});
