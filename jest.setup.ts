// In-memory SecureStore for tests (the real one needs the native keychain).
jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void items.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void items.delete(key)),
    __items: items,
  };
});

// Realtime transport fakes (Pusher and Echo). The shared helper loads these builds, so every build the
// helper can resolve is mocked. The helper itself still runs for real (its channel and event checks
// included); only the socket is faked. Tests read the fake through globalThis.__realtimeFake.
/** Directory part of a resolved file path (the helper's own resolution, not a hard-coded path). */
function dirOf(file: string): string {
  return file.slice(0, file.lastIndexOf('/'));
}

const realtimeFake = {
  stateHandlers: [] as ((state: { current: string }) => void)[],
  joined: [] as string[],
  listens: [] as { channel: string; event: string; handler: (payload: unknown) => void }[],
  left: [] as string[],
  disconnects: 0,
  constructed: 0,
};
(globalThis as unknown as { __realtimeFake: typeof realtimeFake }).__realtimeFake = realtimeFake;

const resolver = require as unknown as { resolve: (id: string, options?: { paths: string[] }) => string };
const realtimeHelperFrom = { paths: [resolver.resolve('@mediconnect/api-client/realtime')] };
const pusherPaths = [
  resolver.resolve('pusher-js', realtimeHelperFrom),
  resolver.resolve('pusher-js/dist/web/pusher.js', realtimeHelperFrom),
  resolver.resolve('pusher-js/dist/node/pusher.js', realtimeHelperFrom),
];
const echoDir = dirOf(resolver.resolve('laravel-echo', realtimeHelperFrom));
const echoPaths = [resolver.resolve('laravel-echo', realtimeHelperFrom), `${echoDir}/echo.js`, `${echoDir}/echo.common.js`];

for (const path of pusherPaths) {
  jest.doMock(path, () => ({
    __esModule: true,
    default: class FakePusher {
      connection = {
        state: 'initialized',
        bind: (_event: string, handler: (state: { current: string }) => void) => realtimeFake.stateHandlers.push(handler),
      };
      constructor() {
        realtimeFake.constructed += 1;
      }
    },
  }));
}

for (const path of echoPaths) {
  jest.doMock(path, () => ({
    __esModule: true,
    default: class FakeEcho {
      join(channel: string) {
        realtimeFake.joined.push(channel);
        return {
          listen: (event: string, handler: (payload: unknown) => void) => realtimeFake.listens.push({ channel, event, handler }),
          stopListening: () => undefined,
        };
      }
      leave(channel: string) {
        realtimeFake.left.push(channel);
      }
      disconnect() {
        realtimeFake.disconnects += 1;
      }
    },
  }));
}
