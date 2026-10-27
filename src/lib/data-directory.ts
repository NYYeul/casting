import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Blob이 연결되지 않은 환경의 업로드 폴더. 체험 모드(서버리스)는 쓰기 가능한 임시 폴더를 쓴다.
export function dataDirectory() {
  return process.env.DEMO_MODE === 'true'
    ? join(tmpdir(), 'casting-swipe-demo')
    : join(process.cwd(), 'data');
}
