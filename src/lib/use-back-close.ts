'use client';

import { useEffect, useRef } from 'react';

/*
 * 시트·팝업을 휴대폰·브라우저의 뒤로가기로 닫을 수 있게 한다.
 *
 * 열릴 때 같은 주소로 브라우저 기록을 하나 쌓고(열린 순서대로 id 목록을 기록에 남긴다),
 * 뒤로가기로 그 기록이 빠지면 해당 시트가 스스로 닫힌다. 겹쳐 열린 경우 위의 것부터 하나씩 닫힌다.
 * 버튼으로 닫으면 쌓아 둔 기록을 함께 지워, 다음 뒤로가기가 헛돌지 않게 한다.
 * pushState는 Next.js 라우터와 연동되는 공식 방법이다(Next 문서 'Native History API').
 */

const KEY = '__csLayers';

function layersOf(state: unknown): string[] {
  const value = (state as Record<string, unknown> | null)?.[KEY];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

// 기록 조작은 한 줄로 세워 순서대로 처리한다. 한 시트를 닫으면서 다른 시트를 바로 여는 경우
// (지원자 상세 → 대화) '지우기'가 끝난 뒤에 '쌓기'가 일어나야 기록이 꼬이지 않는다.
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => void | Promise<void>) {
  queue = queue
    .then(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
    .then(task)
    .catch(() => undefined);
}

const closedByButton = new Set<string>();

function unwind(href: string) {
  // 그사이 다른 화면으로 이동했다면 기록을 건드리지 않는다.
  if (location.href !== href) return;
  const layers = layersOf(history.state);
  let steps = 0;
  while (steps < layers.length && closedByButton.has(layers[layers.length - 1 - steps])) steps++;
  for (const id of layers.slice(layers.length - steps)) closedByButton.delete(id);
  if (steps === 0) return;
  return new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener('popstate', done);
      resolve();
    };
    window.addEventListener('popstate', done);
    history.go(-steps);
  });
}

let counter = 0;

/** open이 true인 동안 뒤로가기 한 번을 '이 시트 닫기'로 쓴다. */
export function useBackClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    counter += 1;
    const id = `layer-${Date.now().toString(36)}-${counter}`;
    let active = true;
    let pushed = false;
    let href = '';
    const onPop = () => {
      if (!pushed || layersOf(history.state).includes(id)) return;
      pushed = false;
      closeRef.current();
    };
    enqueue(() => {
      if (!active) return;
      history.pushState({ [KEY]: [...layersOf(history.state), id] }, '');
      href = location.href;
      pushed = true;
      window.addEventListener('popstate', onPop);
    });
    return () => {
      active = false;
      window.removeEventListener('popstate', onPop);
      if (!pushed) return;
      closedByButton.add(id);
      enqueue(() => unwind(href));
    };
  }, [open]);
}
