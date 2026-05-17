import { afterEach } from 'vitest';

afterEach(() => {
  // Keep test environment isolation predictable between suites.
  localStorage.clear();
  sessionStorage.clear();
});
