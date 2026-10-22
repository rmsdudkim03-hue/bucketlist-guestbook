// 버킷리스트 방명록 서버
// 글은 저장소에 한 개씩 bucket/글id.json 으로 저장 { text, name, shape, color, turn, at }. 글id 앞부분이 '거꾸로 시간'이라 최신이 먼저 나옴
//   shape: 'square' | 'triangle' | 'circle',  color: 0~5 (화면의 색 6개 순서),  turn: 세모 방향 0~3 (◢ ◣ ◤ ◥, 세모만)
// GET                    → 글 전체 { enabled, items: [{ id, text, name, shape, color, at }] } (최신이 먼저)
// POST { text, name, shape, color, turn } → 글 남기기 → { item }. 나쁜 말이면 400 { error: 'bad_word' }
// 관리 (헤더 x-admin-code = Vercel 환경 변수 ADMIN_CODE)
//   GET ?admin=1           → 글 전체 (캐시 없이)
//   POST { remove: 글id }  → 글 지우기
import { send, readJSON, store, newKey } from './_lib.js';
import { hasBadWord, flaggedByAI } from './_badwords.js';

const MAX_TEXT = 80;      // 버킷리스트 최대 글자 수
const MAX_NAME = 12;      // 이름 최대 글자 수
const MAX_ITEMS = 3000;   // 한 번에 보여 줄 최대 글 수
const SHAPES = ['square', 'triangle', 'circle'];
const COLORS = 6;
const ID = /^\d{13}-[a-z0-9]{1,8}$/;

function adminOk(req) {
  const code = String(process.env.ADMIN_CODE || '').trim();
  return Boolean(code) && String(req.headers['x-admin-code'] || '').trim() === code;
}

// 줄바꿈·연속 공백을 한 칸으로, 앞뒤 공백 빼기
const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

// 글 내용은 바뀌지 않으니 한 번 읽은 건 기억해 둠 (서버가 켜져 있는 동안)
const memo = new Map();
async function read(blobs) {
  const out = [];
  // 한 번에 너무 많이 부르지 않게 20개씩
  for (let i = 0; i < blobs.length; i += 20) {
    const part = await Promise.all(blobs.slice(i, i + 20).map(async (b) => {
      const id = b.pathname.slice(7, -5);
      if (memo.has(id)) return memo.get(id);
      try {
        const it = { id, ...(await store.readJSON(b.url)) };
        memo.set(id, it);
        return it;
      } catch { return null; }
    }));
    out.push(...part.filter(Boolean));
  }
  return out;
}

async function all() {
  const blobs = [];
  let cursor = null;
  do {
    const p = await store.page('bucket/', 1000, cursor);
    blobs.push(...p.blobs);
    cursor = p.cursor;
  } while (cursor && blobs.length < MAX_ITEMS);
  return read(blobs.slice(0, MAX_ITEMS));
}

// 같은 기기(IP)에서 너무 자주 쓰지 않게 (서버가 켜져 있는 동안만 기억하는 간단한 방법)
const lastPost = new Map();
const GAP_MS = 10_000;

async function post(req, res) {
  const body = await readJSON(req);

  if (body.remove !== undefined) {
    if (!adminOk(req)) return send(res, 401, { error: 'admin_code' });
    if (!ID.test(String(body.remove))) return send(res, 400, { error: 'input' });
    const [b] = await store.list(`bucket/${body.remove}.`, 1);
    if (b) await store.del(b.url);
    memo.delete(body.remove);
    console.log(`[방명록] 글 지움: ${body.remove}`);
    return send(res, 200, { ok: true });
  }

  const text = clean(body.text, MAX_TEXT);
  const name = clean(body.name, MAX_NAME);
  const shape = SHAPES.includes(body.shape) ? body.shape : null;
  const color = Number(body.color);
  if (!text) return send(res, 400, { error: 'empty' });
  if (!shape || !Number.isInteger(color) || color < 0 || color >= COLORS) return send(res, 400, { error: 'input' });

  if (hasBadWord(text) || hasBadWord(name) || (await flaggedByAI(name ? `${text}\n${name}` : text))) {
    return send(res, 400, { error: 'bad_word' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  const now = Date.now();
  if (now - (lastPost.get(ip) || 0) < GAP_MS) return send(res, 429, { error: 'too_fast' });
  lastPost.set(ip, now);
  if (lastPost.size > 5000) lastPost.clear();

  const id = newKey();
  const turn = Number(body.turn);
  const item = { text, name, shape, color, ...(shape === 'triangle' ? { turn: Number.isInteger(turn) && turn >= 0 && turn < 4 ? turn : 0 } : {}), at: new Date().toISOString() };
  await store.put(`bucket/${id}.json`, JSON.stringify(item), 'application/json');
  memo.set(id, { id, ...item });
  send(res, 200, { item: { id, ...item } });
}

export default async function bucket(req, res) {
  try {
    if (!(await store.ready())) {
      return req.method === 'GET' ? send(res, 200, { enabled: false, items: [] }) : send(res, 503, { error: 'no_store' });
    }
    if (req.method === 'POST') return await post(req, res);
    if (req.method !== 'GET') return send(res, 405, { error: 'method' });

    if (new URL(req.url, 'http://x').searchParams.has('admin')) {
      if (!adminOk(req)) return send(res, 401, { error: 'admin_code' });
      return send(res, 200, { items: await all() });
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // 많은 사람이 동시에 열어도 저장소를 매번 읽지 않게 5초 동안 같은 결과를 씀
    res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
    res.end(JSON.stringify({ enabled: true, items: await all() }));
  } catch (err) {
    console.error(err);
    send(res, 500, { error: String(err.message || err).slice(0, 300) });
  }
}
