import jsesc from 'jsesc';
import stripAnsi from 'strip-ansi';

export { mockGraphQLServer } from './mock-graphql-server';

export function nonTTY(msg: string) {
  return stripAnsi(jsesc(stripAnsi(msg)));
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /**
       * Strips and normalizes logs
       */
      toHaveBeenCalledNormalized(expected: string): R;
    }
  }
}

expect.extend({
  toHaveBeenCalledNormalized(spy: jest.SpyInstance, expected: string) {
    const normalizedExpected = nonTTY(expected);
    const calls = spy.mock.calls;
    const contain = calls.some(args => nonTTY(args.join(' ')).includes(normalizedExpected));

    if (contain) {
      return {
        message: () => `expected not to be a called with ${expected}`,
        pass: true,
      };
    }
    const message = `expected to be called with ${expected}`;

    return {
      message: () => message,
      pass: false,
    };
  },
});
