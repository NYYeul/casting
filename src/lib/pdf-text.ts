// PDF에서 글자만 뽑아낸다. 외부 라이브러리 없이 node:zlib만 쓴다.
//
// 뽑아낸 글자는 프로필 '초안'을 만드는 재료일 뿐이고, 배우가 확인한 뒤에 저장한다.
// 그래서 완벽한 PDF 파서가 아니어도 되고, 못 읽으면 못 읽었다고 알려 주면 된다.
//
// 읽을 수 있는 것: 글자가 글자로 들어 있는 PDF (워드·한글·구글 문서에서 내보낸 것).
// 읽을 수 없는 것: 스캔한 종이·사진으로 만든 PDF (글자 이미지라 OCR이 필요하다).
//
// 알려진 한계: 글꼴마다 ToUnicode 표가 따로 있는데 여기서는 표를 하나로 합쳐 쓴다.
// 글꼴이 여러 개인 PDF는 같은 코드가 글꼴마다 다른 글자를 뜻해서 몇 글자가 다르게 읽힐 수 있다.
// 글꼴별로 표를 갈라 쓰려면 페이지 Resources → Font → ToUnicode 참조를 따라가야 하는데,
// 초안을 사람이 확인하고 채우는 흐름이라 그만한 복잡도를 들이지 않았다.
// 글자가 많이 틀리면 화면의 '내용 붙여넣기'로 돌아가면 된다.

import { inflateRawSync, inflateSync } from 'node:zlib';

export type PdfText = {
  text: string;
  /** good: 충분히 읽음 · thin: 글자가 너무 적음 · none: 글자를 못 찾음(스캔 PDF로 추정) */
  quality: 'good' | 'thin' | 'none';
};

/** 내용 스트림을 다 합쳐도 이 길이를 넘으면 자른다 (지나치게 큰 파일 보호) */
const MAX_CONTENT = 4_000_000;
const ENOUGH = 120;

type PdfObject = { dict: string; data: Buffer | null };

/** 'N M obj … endobj' 덩어리를 훑는다. 스트림 안의 바이트는 건너뛰어 잘못 걸리지 않게 한다. */
function parseObjects(raw: Buffer): PdfObject[] {
  const latin = raw.toString('latin1');
  const objects: PdfObject[] = [];
  const header = /(\d+)\s+(\d+)\s+obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = header.exec(latin))) {
    const bodyStart = match.index + match[0].length;
    const streamAt = latin.indexOf('stream', bodyStart);
    const objEnd = latin.indexOf('endobj', bodyStart);
    if (objEnd < 0) break;
    if (streamAt < 0 || streamAt > objEnd) {
      objects.push({ dict: latin.slice(bodyStart, objEnd), data: null });
      header.lastIndex = objEnd;
      continue;
    }
    let dataStart = streamAt + 'stream'.length;
    if (latin[dataStart] === '\r') dataStart += 1;
    if (latin[dataStart] === '\n') dataStart += 1;
    const streamEnd = latin.indexOf('endstream', dataStart);
    if (streamEnd < 0) break;
    objects.push({
      dict: latin.slice(bodyStart, streamAt),
      data: raw.subarray(dataStart, streamEnd),
    });
    header.lastIndex = streamEnd;
  }
  return objects;
}

/** Flate로 압축된 스트림만 푼다. 그림(DCTDecode 등)은 글자가 아니라 건너뛴다. */
function inflate(object: PdfObject): string | null {
  if (!object.data || object.data.length === 0) return null;
  if (!/\/Filter/.test(object.dict)) return object.data.toString('latin1');
  if (!/\/FlateDecode/.test(object.dict)) return null;
  for (const unpack of [inflateSync, inflateRawSync]) {
    try {
      return unpack(object.data).toString('latin1');
    } catch {
      /* 다음 방법으로 */
    }
  }
  return null;
}

/** 'AC00' 같은 UTF-16BE 16진수 → 글자 */
function fromHex(hex: string): string {
  let out = '';
  for (let index = 0; index + 3 < hex.length; index += 4)
    out += String.fromCharCode(parseInt(hex.slice(index, index + 4), 16));
  // 2자리만 남은 경우(1바이트 인코딩)
  if (hex.length === 2) out += String.fromCharCode(parseInt(hex, 16));
  return out;
}

/**
 * ToUnicode CMap에서 '글자 코드 → 글자' 표를 읽는다.
 * 한글은 대부분 Identity-H + ToUnicode 조합으로 들어가므로 이 표가 있어야 읽을 수 있다.
 * 글꼴이 여럿이면 표를 합친다 — 초안이라 조금 섞여도 배우가 고치면 된다.
 */
function readCMap(content: string, into: Map<string, string>) {
  for (const block of content.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const pair of block.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) ?? []) {
      const [code, value] = pair.match(/<([0-9A-Fa-f]+)>/g)!.map((part) => part.slice(1, -1));
      if (!into.has(code.toUpperCase())) into.set(code.toUpperCase(), fromHex(value));
    }
  }
  for (const block of content.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    const rows = block.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) ?? [];
    for (const row of rows) {
      const parts = row.match(/<([0-9A-Fa-f]+)>/g)!.map((part) => part.slice(1, -1));
      const from = parseInt(parts[0], 16);
      const to = parseInt(parts[1], 16);
      const start = parseInt(parts[2], 16);
      if (!Number.isFinite(from) || !Number.isFinite(to) || to - from > 65535) continue;
      const width = parts[0].length;
      for (let offset = 0; offset <= to - from; offset += 1) {
        const code = (from + offset).toString(16).toUpperCase().padStart(width, '0');
        if (!into.has(code)) into.set(code, String.fromCharCode(start + offset));
      }
    }
  }
}

/** PDF 문자열 리터럴 '( … )'의 이스케이프를 푼다. */
function readLiteral(body: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char !== '\\') {
      bytes.push(body.charCodeAt(index));
      continue;
    }
    const next = body[++index];
    const simple: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
    if (next in simple) bytes.push(simple[next]);
    else if (next >= '0' && next <= '7') {
      let octal = next;
      while (octal.length < 3 && body[index + 1] >= '0' && body[index + 1] <= '7')
        octal += body[++index];
      bytes.push(parseInt(octal, 8) & 0xff);
    } else if (next === '\n') {
      /* 줄 이어 쓰기 */
    } else if (next !== undefined) bytes.push(body.charCodeAt(index));
  }
  return bytes;
}

function decodeBytes(bytes: number[], cmap: Map<string, string>, twoByte: boolean): string {
  if (cmap.size === 0) return Buffer.from(bytes).toString('latin1');
  let out = '';
  const step = twoByte ? 2 : 1;
  for (let index = 0; index + step - 1 < bytes.length; index += step) {
    const code = bytes
      .slice(index, index + step)
      .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
    const mapped = cmap.get(code);
    if (mapped !== undefined) out += mapped;
    else if (!twoByte && bytes[index] >= 32) out += String.fromCharCode(bytes[index]);
  }
  return out;
}

/**
 * 내용 스트림에서 글자를 보여 주는 연산자만 골라 읽는다.
 *
 * 줄바꿈은 글자 위치를 옮기는 연산자로 판단한다. Td/TD는 '옮기는 양'이라
 * 세로로 움직였을 때만(ty ≠ 0) 줄을 바꾸고, 가로로만 움직였으면 같은 줄의 띄어쓰기로 본다.
 * 이렇게 하지 않으면 한 줄짜리 제목이 글자 덩어리마다 끊겨 '캐스 / 스와이프'처럼 쪼개진다.
 */
function readShownText(content: string, cmap: Map<string, string>, twoByte: boolean): string {
  const token =
    /\((?:\\[\s\S]|[^\\()])*\)|<[0-9A-Fa-f\s]+>|(-?[\d.]+)\s+(-?[\d.]+)\s+T([dD])\b|((?:-?[\d.]+\s+){6})Tm\b|\bT\*\b/g;
  let out = '';
  let lastY: number | null = null;
  let match: RegExpExecArray | null;
  while ((match = token.exec(content))) {
    const [piece, , moveY, , matrix] = match;
    if (piece.startsWith('(')) {
      out += decodeBytes(readLiteral(piece.slice(1, -1)), cmap, twoByte);
    } else if (piece.startsWith('<')) {
      const hex = piece.slice(1, -1).replace(/\s+/g, '');
      out += cmap.size > 0 ? decodeBytes(hexBytes(hex), cmap, twoByte) : fromHex(hex);
    } else if (moveY !== undefined) {
      out += Number(moveY) === 0 ? ' ' : '\n';
    } else if (matrix !== undefined) {
      // Tm은 절대 위치라, 세로 위치가 달라졌을 때만 줄을 바꾼다.
      const y = Number(matrix.trim().split(/\s+/)[5]);
      out += lastY !== null && Math.abs(y - lastY) < 0.5 ? ' ' : '\n';
      lastY = y;
    } else {
      out += '\n';
    }
  }
  return out;
}

function hexBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index + 1 < hex.length; index += 2)
    bytes.push(parseInt(hex.slice(index, index + 2), 16));
  return bytes;
}

export function extractPdfText(raw: Buffer): PdfText {
  const objects = parseObjects(raw);
  const cmap = new Map<string, string>();
  const contents: string[] = [];
  let size = 0;

  for (const object of objects) {
    const content = inflate(object);
    if (!content) continue;
    if (/begincmap|beginbfchar|beginbfrange/.test(content)) {
      readCMap(content, cmap);
      continue;
    }
    if (!/\bTj\b|\bTJ\b/.test(content)) continue;
    if (size + content.length > MAX_CONTENT) break;
    size += content.length;
    contents.push(content);
  }

  // ToUnicode 표의 코드가 4자리면 한 글자가 2바이트다 (한글 PDF의 보통 경우).
  const twoByte = [...cmap.keys()].some((code) => code.length === 4);
  const text = contents
    .map((content) => readShownText(content, cmap, twoByte))
    .join('\n')
    // 한글 PDF는 '다' + 종성 'ᆫ'처럼 자모를 따로 담는 경우가 많다. NFC로 합쳐야 '단'이 된다.
    .normalize('NFC')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  const letters = text.replace(/\s/g, '').length;
  return { text, quality: letters === 0 ? 'none' : letters < ENOUGH ? 'thin' : 'good' };
}
