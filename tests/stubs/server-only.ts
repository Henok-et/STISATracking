/**
 * `server-only` throws by design when it is imported outside a React Server
 * Component build. That guard is correct in the app and useless in a test
 * runner, where every module already runs in Node. Vitest aliases the package
 * to this empty module so the modules it protects can be tested directly.
 */
export {};
