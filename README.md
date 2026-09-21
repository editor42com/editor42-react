# Official Editor42 React component

## About

This package is a thin wrapper around [Editor42](https://github.com/editor42com/editor42),
the auditable MIT fork of TinyMCE 6, to make it easier to use in a React application.

Documentation lives at [editor42.com](https://editor42.com/docs).

## Installation

```sh
npm install @editor42/editor42-react
```

## Usage

```jsx
import { Editor } from '@editor42/editor42-react';

export default function App() {
  return (
    <Editor
      initialValue="<p>Hello from Editor42</p>"
      init={{ height: 400 }}
    />
  );
}
```

With no extra props the editor script is loaded from `https://cdn.editor42.com` on the
`latest` channel. There is no account, no sign-up and no key of any kind. The `latest`
pointer only ever moves for security and bug-fix releases, because the Editor42 major
version is fixed forever.

## Self-hosting

Point the component at your own copy of the script, using the full file URL:

```jsx
<Editor editor42ScriptSrc="/js/editor42/editor42.min.js" />
```

An array is accepted for loading the editor plus separate bundles, and array items may
set `integrity` and `crossOrigin` for CSP-hardened deployments. Passing an empty array
opts out of script loading entirely, for pages that load the editor themselves.

## Pinning a version

```jsx
<Editor channel="42.0.0" />
```

`channel` accepts `latest`, a `latest-N` alias, or an exact version.

## Editor options

Everything else is an Editor42 option, passed through `init`:

```jsx
<Editor init={{ height: 400, menubar: false, plugins: 'lists link' }} />
```

See the [Editor42 documentation](https://editor42.com/docs) for the full list.

## Migrating from the TinyMCE React component

```sh
npm uninstall @tinymce/tinymce-react
npm install @editor42/editor42-react
```

Change the import to `@editor42/editor42-react` and you are done. Prop, event and component names
are unchanged, and the old `tinymceScriptSrc` and `cloudChannel` props keep working as
deprecated aliases of `editor42ScriptSrc` and `channel`.

All API-key and licence-key handling has been removed. The corresponding props are still
accepted so existing code compiles, but they do nothing: no key is read, stored or sent
anywhere, and no request ever reaches a vendor cloud.

The component also drives a stock TinyMCE if that is what is already loaded on the page,
which keeps the switch reversible. Configuring TinyMCE itself is outside the scope of
this package.

## Issues

Found an issue or have a feature request? Open an
[issue](https://github.com/editor42com/editor42-react/issues) or submit a pull request.
For issues with the editor itself, use the
[Editor42 repository](https://github.com/editor42com/editor42/issues).

## License

MIT. See [LICENSE.txt](LICENSE.txt).
