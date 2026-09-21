import type { Editor42 } from 'editor42';

// Resolve the engine global. Editor42 wins when both engines are on the page; a real
// TinyMCE is a supported fallback so this component can drive either engine.
const getEditor42 = (view: Window): Editor42 | null => {
  const global = view as any;

  return global?.editor42 ?? global?.tinymce ?? null;
};

export { getEditor42 };
