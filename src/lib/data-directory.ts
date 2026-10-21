import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function dataDirectory() {
  if (process.env.DEMO_BUILD === 'true') return join(process.cwd(), '.demo');
  return process.env.DEMO_MODE === 'true'
    ? join(tmpdir(), 'casting-swipe-demo')
    : join(process.cwd(), 'data');
}
