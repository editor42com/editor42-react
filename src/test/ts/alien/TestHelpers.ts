import { Assertions } from '@ephox/agar';
import { Cell, Obj } from '@ephox/katamari';
import { Version } from 'src/main/ts/components/Editor';
import { Editor as Editor42Editor } from 'editor42';
import { Engine } from './Loader';

interface EventHandlerArgs<T> {
  editorEvent: T;
  editor: Editor42Editor;
}

type HandlerType<A> = (a: A, editor: Editor42Editor) => unknown;

const VERSIONS: Version[] = [ '5', '6', '7' ];
// Editor42 first: it is the engine these components target; the TinyMCE versions
// stay as the compatibility matrix.
const ENGINES: Engine[] = [ 'editor42', ...VERSIONS ];

const EventStore = () => {
  const state: Cell<Record<string, EventHandlerArgs<unknown>[]>> = Cell({});

  const createHandler = <T>(name: string): HandlerType<T> => (event: T, editor) => {
    const oldState = state.get();

    const eventHandlerState = Obj.get(oldState, name)
      .getOr([] as EventHandlerArgs<unknown>[])
      .concat([{ editorEvent: event, editor }]);

    state.set({
      ...oldState,
      [name]: eventHandlerState
    });
  };

  const each = <T>(name: string, assertState: (state: EventHandlerArgs<T>[]) => void) => {
    Assertions.assertEq('State from "' + name + '" handler should exist', true, name in state.get());
    assertState(state.get()[name] as unknown as EventHandlerArgs<T>[]);
  };

  const clearState = () => {
    state.set({});
  };

  return {
    each,
    createHandler,
    clearState
  };
};

export {
  EventStore,
  VERSIONS,
  ENGINES,
  Version
};