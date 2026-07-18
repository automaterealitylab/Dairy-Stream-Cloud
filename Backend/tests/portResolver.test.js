import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailablePort } from '../utils/portResolver.js';

const preferredPort = 4011;

test('getAvailablePort returns a usable port', async () => {
  const port = await getAvailablePort(preferredPort);
  assert.ok(Number.isInteger(port));
  assert.ok(port >= preferredPort);
});
