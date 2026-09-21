import { Fun, Optional } from '@ephox/katamari';
import { Remove, SugarElement, SugarNode } from '@ephox/sugar';
import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { Editor, IAllProps, IProps, Version } from '../../../main/ts/components/Editor';
import { Editor as Editor42Editor } from 'editor42';
import { after, before, context } from '@ephox/bedrock-client';
import { VersionLoader } from '@tinymce/miniature';
import { setMode } from 'src/main/ts/Utils';

// @ts-expect-error Remove when dispose polyfill is not needed
Symbol.dispose ??= Symbol('Symbol.dispose');
// @ts-expect-error Remove when dispose polyfill is not needed
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

export interface Context {
  DOMNode: HTMLElement;
  editor: Editor42Editor;
  ref: React.RefObject<Editor>;
}

const getRoot = () => Optional.from(document.getElementById('root')).getOrThunk(() => {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  return root;
});
export interface ReactEditorContext extends Context, Disposable {
  reRender(props: IAllProps): Promise<void>;
  remove(): void;
}

export const render = async (props: Partial<IAllProps> = {}, container: HTMLElement = getRoot()): Promise<ReactEditorContext> => {
  const originalInit = props.init || {};
  const originalSetup = originalInit.setup || Fun.noop;
  const ref = React.createRef<Editor>();
  const root = ReactDOMClient.createRoot(container);

  const ctx = await new Promise<Context>((resolve, reject) => {
    const init: IProps['init'] = {
      ...originalInit,
      setup: (editor) => {
        originalSetup(editor);

        editor.on('SkinLoaded', () => {
          setTimeout(() => {
            Optional.from(ref.current)
              .bind((editorInstance) => Optional.from(editorInstance.editor?.targetElm))
              .map(SugarElement.fromDom)
              .filter(SugarNode.isHTMLElement)
              .map((val) => val.dom)
              .fold(() => reject('Could not find DOMNode'), (DOMNode) => {
                resolve({
                  ref: ref as React.RefObject<Editor>,
                  editor,
                  DOMNode,
                });
              }
              );
          }, 0);
        });
      }
    };

    /**
     * NOTE: TinyMCE will manipulate the DOM directly and this may cause issues with React's virtual DOM getting
     * out of sync. The official fix for this is wrap everything (textarea + editor) in an element. As far as React
     * is concerned, the wrapper always only has a single child, thus ensuring that React doesn’t have a reason to
     * touch the nodes created by TinyMCE. Since this only seems to be an issue when rendering TinyMCE 4 directly
     * into a root and a fix would be a breaking change, let's just wrap the editor in a <div> here for now.
     */
    root.render(<div><Editor ref={ref} apiKey='no-api-key' {...props} init={init} licenseKey='gpl'/></div>);
  });

  const remove = () => {
    root.unmount();
    Remove.remove(SugarElement.fromDom(container));
  };

  return {
    ...ctx,
    /** By rendering the Editor into the same root, React will perform a diff and update. */
    reRender: (newProps: IAllProps) => new Promise<void>((resolve) => {
      root.render(<div><Editor apiKey='no-api-key' ref={ctx.ref} {...newProps}/></div>);

      if (newProps.disabled) {
        setMode(ctx.editor, 'readonly');
      }

      newProps.value
        ? ctx.editor.once('change', (_event) => resolve())
        : resolve();
    }),
    remove,
    [Symbol.dispose]: remove
  };
};

type RenderWithVersion = (
  props: Omit<IAllProps, 'cloudChannel' | 'tinymceScriptSrc'>,
  container?: HTMLElement | HTMLDivElement
) => Promise<ReactEditorContext>;

export type Engine = Version | 'editor42';

const EDITOR42_SRC = '/project/node_modules/editor42/editor42.min.js';

// Drop editor42 from the page (and the shim aliases it may have installed) so a
// following context can load the engine it actually asked for.
export const cleanEditor42 = (): void => {
  const w = window as any;
  if (w.tinymce !== undefined && w.tinymce === w.editor42) {
    delete w.tinymce;
  }
  if (w.tinyMCE !== undefined && w.tinyMCE === w.editor42) {
    delete w.tinyMCE;
  }
  delete w.editor42;
  delete w.EDITOR42_NO_SHIM;
  document.querySelectorAll('script[src*="editor42"]').forEach((s) => s.parentNode?.removeChild(s));
};

// Full engine sweep: globals, editors and script tags of BOTH engines. Contexts use it
// so every test file is self-cleaning regardless of the order bedrock runs files in.
export const cleanAllEngines = (): void => {
  const w = window as any;
  cleanEditor42();
  delete w.tinymce;
  delete w.tinyMCE;
  document.querySelectorAll('script[src*="tinymce"]').forEach((s) => s.parentNode?.removeChild(s));
};

export const pLoadEditor42 = (options: { noShim?: boolean } = {}): Promise<void> => {
  cleanEditor42();
  if (options.noShim) {
    (window as any).EDITOR42_NO_SHIM = true;
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = EDITOR42_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('failed to load ' + EDITOR42_SRC));
    document.head.appendChild(script);
  });
};

export const withVersion = (version: Engine, fn: (render: RenderWithVersion) => void): void => {
  const label = version === 'editor42' ? 'Editor42' : `TinyMCE (${version})`;
  context(label, () => {
    before(async () => {
      if (version === 'editor42') {
        await pLoadEditor42();
      } else {
        cleanEditor42();
        await VersionLoader.pLoadVersion(version);
      }
    });

    after(() => {
      cleanAllEngines();
    });

    fn(render as RenderWithVersion);
  });
};
