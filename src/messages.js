// Language-neutral protocol values; localization belongs to the viewer.
export class AppError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.code = code;
    this.params = params;
  }
}
export const event = (code, params = {}) => ({ code, params });
export function errorEvent(error) {
  return error instanceof AppError
    ? event(error.code, error.params)
    : event(
        error instanceof SyntaxError
          ? 'error.invalidMessage'
          : 'error.internal',
      );
}
