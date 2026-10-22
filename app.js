/* our momi MAP — 판·쓰기·보기 동작
   - 글 하나 = 모미 하나 (관람객이 고른 모양 + 색). 판은 68px 칸 + 3px 틈 (피그마 'iPhone 17 - 9')
   - 모미 자리는 글 순서와 글id로 정해져서 누가 열어도 같은 지도:
     첫 모미는 가운데 칸(0,0), 다음부터는 이미 놓인 모미 둘레(대각선 포함) 빈칸 중
     가운데에 가깝고 옆에 붙은 모미가 적은 곳 (+ 글id로 만든 무작위) → 덩어리가 사방으로 자람
   - 판은 손가락으로 끌어서 둘러봄 (놓으면 조금 미끄러짐). 모미를 누르면 글
   - 30초마다 새 글 확인. 방금 쓴 모미에만 체크 모션이 한 번 나오고, 끝나면 체크도 사라짐 */
const API = '/api/bucket';
const SHAPES = ['square', 'circle', 'triangle'];          // 고르기 칸 순서 (피그마: 네모 · 동그라미 · 세모)
const PALETTE = [5, 2, 3, 4, 0, 1];                         // 색 점 순서 (연두·주황·분홍·초록·보라·하늘) → 저장 번호 --c0~--c5
const COLOR_NAMES = ['보라', '하늘', '주황', '분홍', '초록', '연두'];
const SHAPE_NAMES = { square: '네모', circle: '동그라미', triangle: '세모' };
const col = (i) => `var(--c${i})`;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* ---------- 모양 (피그마에서 꺼낸 그대로) ---------- */
const TRI = 'M55.8905 0.589681C57.1505 -0.670108 59.3046 0.222263 59.3046 2.004L59.3046 57.2966C59.3046 58.4012 58.4092 59.2966 57.3046 59.2966H2.00398C0.222096 59.2966 -0.670209 57.1422 0.589861 55.8823L55.8905 0.589681Z';
const TRI_BIG = 'M126.881 0.294909C127.511 -0.335055 128.588 0.111107 128.588 1.00201L128.588 127.588C128.588 128.14 128.14 128.588 127.588 128.588H1.00211C0.111203 128.588 -0.334968 127.511 0.294997 126.881L126.881 0.294909Z';
const TRI_ICON = 'M24.8808 0.294872C25.5107 -0.335093 26.5879 0.111077 26.5879 1.00198L26.5879 25.5878C26.5879 26.1401 26.1402 26.5878 25.5879 26.5878H1.0021C0.111198 26.5878 -0.334968 25.5106 0.294997 24.8807L24.8808 0.294872Z';
// 판 위 한 칸(68): 네모 62(안쪽 3), 동그라미 68, 세모 ◢
const CELL_SVG = {
  square: '<rect x="3" y="3" width="62" height="62" rx="2"/>',
  circle: '<circle cx="34" cy="34" r="34"/>',
  triangle: `<path transform="translate(5.83 5.83)" d="${TRI}"/>`,
};
// 미리보기·보기 (151): 동그라미 151, 세모·네모 130
const BIG_SVG = {
  square: '<rect x="10.5" y="10.5" width="130" height="130" rx="4"/>',
  circle: '<circle cx="75.5" cy="75.5" r="75.5"/>',
  triangle: `<path transform="translate(4 -5)" d="${TRI_BIG}"/>`,   // 피그마 13: 세모가 8 위로
};
// 고르기 칸 안의 작은 모양
const ICON_SVG = {
  square: '<svg viewBox="0 0 23 23"><rect width="23" height="23" rx="2"/></svg>',
  circle: '<svg viewBox="0 0 25 25"><circle cx="12.5" cy="12.5" r="12.5"/></svg>',
  triangle: `<svg viewBox="0 0 27 27"><path d="${TRI_ICON}"/></svg>`,
};

// 방금 쓴 모미에 그려지는 체크 (원 테두리 → 검정 채움 → 체크 한 획 → 톡 + 짧은 선 10개·물결)
const RAYS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2, x = (r) => (42 + Math.cos(a) * r).toFixed(1), y = (r) => (42 + Math.sin(a) * r).toFixed(1);
  return `<line class="ray" x1="${x(39)}" y1="${y(39)}" x2="${x(64)}" y2="${y(64)}"/>`;
}).join('');
const DONE = `<svg class="done" viewBox="0 0 84 84" aria-hidden="true">${RAYS}<circle class="wave" cx="42" cy="42" r="36"/>`
  + '<circle class="fillc" cx="42" cy="42" r="36"/><circle class="ring" cx="42" cy="42" r="36"/>'
  + '<g class="ck"><path class="chk" d="M29 43.5 L38.5 53 L56 33"/></g></svg>';

// 큰 모미 (모양 + 안에 글·날짜)
function bigHTML(it) {
  return `<svg viewBox="0 0 151 151" aria-hidden="true"><g fill="${col(it.color)}">${BIG_SVG[it.shape]}</g></svg>`
    // 글을 쓰기 전(빈 미리보기)엔 글·날짜 없이 모양만 (피그마 'iPhone 17 - 12')
    + (it.text ? `<p class="txt">${esc(it.text)}</p><p class="date">${esc(day(it.at))}</p>` : '');
}
// 세모(◢) 안 글이 길면 빗변 밖으로 나가지 않을 때까지 글자를 줄임 (12 → 최소 8, 피그마 기준 크기)
// 세모 안쪽 = 미리보기 칸(151) 기준 x + y ≥ 128 인 곳. 글 상자의 왼쪽 위 모서리가 그 안에 들어오면 OK
function fitTri(big) {
  const t = big.querySelector('.txt');
  if (!big.classList.contains('triangle') || !t) return;
  const box = big.getBoundingClientRect(), k = 151 / box.width;
  for (let size = 12; size >= 8; size -= 0.5) {
    t.style.fontSize = `calc(var(--u) * ${size})`;
    const r = t.getBoundingClientRect();
    if ((r.left - box.left) * k + (r.top - box.top) * k >= 124) return;
  }
}
function day(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/* ---------- 데이터 ---------- */
let items = [];                 // 오래된 글 → 최신 글
const seen = new Set();         // 이미 그린 글 (새 글만 톡 튀어나오게)
let drawn = false;
let justPosted = null;          // 방금 쓴 글 (체크 모션을 보여 줄 모미)

// 내가 쓴 글 id (이 휴대폰에만 저장. 못 쓰는 환경이면 그냥 넘어감)
const MINE_KEY = 'bucket-mine';
let mine = [];
try { mine = JSON.parse(localStorage.getItem(MINE_KEY) || '[]'); } catch { /* 없음 */ }
function rememberMine(id) {
  mine = [id, ...mine].slice(0, 20);
  try { localStorage.setItem(MINE_KEY, JSON.stringify(mine)); } catch { /* 없음 */ }
}

/* ---------- 자리 정하기 ---------- */
// 글id로 늘 같은 무작위 수를 만듦
function rng(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function layout(list) {
  const key = (c, r) => `${c},${r}`;
  const taken = new Set();
  const cand = new Map();   // 비어 있고 옆에 모미가 있는 칸
  const out = [];
  for (const it of list) {
    // 예전 글(모양·색 없음)은 글id로 정해 둠
    if (!SHAPES.includes(it.shape)) it.shape = SHAPES[Math.floor(rng(it.id + 's')() * 3)];
    if (!(it.color >= 0 && it.color < 6)) it.color = Math.floor(rng(it.id + 'c')() * 6);
    const rand = rng(it.id);
    let best = { c: 0, r: 0 };
    if (taken.size) {
      let bestScore = Infinity;
      for (const p of [...cand.values()].sort((a, b) => a.c - b.c || a.r - b.r)) {
        let touch = 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (taken.has(key(p.c + dc, p.r + dr))) touch++;
        const score = Math.hypot(p.c, p.r * 1.15) + touch * 0.45 + rand() * 1.4;
        if (score < bestScore) { bestScore = score; best = p; }
      }
    }
    taken.add(key(best.c, best.r));
    cand.delete(key(best.c, best.r));
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const c = best.c + dc, r = best.r + dr;
      if (!taken.has(key(c, r))) cand.set(key(c, r), { c, r });
    }
    out.push({ it, c: best.c, r: best.r });
  }
  return out;
}

/* ---------- 판 그리기 ---------- */
const map = $('map'), world = $('world');
let placed = [];
let bounds = { c0: 0, c1: 0, r0: 0, r1: 0 };

function render() {
  placed = layout(items);
  bounds = placed.reduce((b, p) => ({
    c0: Math.min(b.c0, p.c), c1: Math.max(b.c1, p.c), r0: Math.min(b.r0, p.r), r1: Math.max(b.r1, p.r),
  }), { c0: 0, c1: 0, r0: 0, r1: 0 });
  world.replaceChildren(...placed.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'momi';
    b.dataset.id = p.it.id;
    b.style.left = `calc(var(--u) * ${p.c * 71})`;
    b.style.top = `calc(var(--u) * ${p.r * 71})`;
    b.setAttribute('aria-label', `${SHAPE_NAMES[p.it.shape]} 모미: ${p.it.text}`);
    b.innerHTML = `<svg viewBox="0 0 68 68" aria-hidden="true"><g fill="${col(p.it.color)}">${CELL_SVG[p.it.shape]}</g></svg>`
      + (p.it.id === justPosted ? DONE : '');   // 체크는 방금 쓴 모미에만, 모션이 끝날 때까지
    if (drawn && !seen.has(p.it.id)) b.classList.add('pop');
    return b;
  }));
  placed.forEach((p) => seen.add(p.it.id));
  drawn = true;
  $('count').textContent = `${items.length}개의 모미 보관중`;
  clampPan();
  place();
}

/* ---------- 끌어서 둘러보기 ---------- */
// 칸(0,0) = 피그마 프레임의 (202, 427). 화면 높이가 달라도 세로 가운데 기준으로 맞춤
let pan = { x: 0, y: 0 };
function origin() {
  const W = Math.min(innerWidth, 480), U = W / 402;
  return { U, x: (innerWidth - W) / 2 + 202 * U, y: innerHeight / 2 + (427 - 437) * U };
}
function place() {
  const o = origin();
  const x = o.x + pan.x, y = o.y + pan.y;
  world.style.transform = `translate(${x}px, ${y}px)`;
  map.style.backgroundPosition = `${x}px ${y}px`;
}
// 화면 가운데가 모미 덩어리(+ 둘레 2칸) 밖으로 나가지 않게
function clampPan() {
  const o = origin(), s = 71 * o.U, m = 2 * s;
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const minX = bounds.c0 * s - m, maxX = (bounds.c1 + 1) * s + m;
  const minY = bounds.r0 * s - m, maxY = (bounds.r1 + 1) * s + m;
  pan.x = Math.min(cx - o.x - minX, Math.max(cx - o.x - maxX, pan.x));
  pan.y = Math.min(cy - o.y - minY, Math.max(cy - o.y - maxY, pan.y));
}

let drag = null, moved = false, coast = 0;
map.addEventListener('pointerdown', (e) => {
  cancelAnimationFrame(coast);
  drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, t: performance.now(), vx: 0, vy: 0 };
  moved = false;
});
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!moved && Math.hypot(dx, dy) < 6) return;   // 조금 움직인 건 '누르기'로 봄
  moved = true;
  map.classList.add('dragging');
  const now = performance.now(), nx = drag.px + dx, ny = drag.py + dy;
  const dt = Math.max(1, now - drag.t);
  drag.vx = (nx - pan.x) / dt; drag.vy = (ny - pan.y) / dt; drag.t = now;
  pan.x = nx; pan.y = ny;
  clampPan();
  place();
});
addEventListener('pointerup', () => {
  if (!drag) return;
  map.classList.remove('dragging');
  // 놓으면 조금 더 미끄러지다 멈춤
  let { vx, vy } = drag;
  drag = null;
  if (!moved) return;
  let last = performance.now();
  const step = (now) => {
    const dt = now - last; last = now;
    pan.x += vx * dt; pan.y += vy * dt;
    vx *= 0.92; vy *= 0.92;
    clampPan(); place();
    if (Math.hypot(vx, vy) > 0.02) coast = requestAnimationFrame(step);
  };
  coast = requestAnimationFrame(step);
});
addEventListener('pointercancel', () => { drag = null; map.classList.remove('dragging'); });
addEventListener('resize', () => { clampPan(); place(); });

// 어떤 모미를 화면 가운데로 부드럽게 옮김
function glideTo(id, after) {
  const p = placed.find((q) => q.it.id === id);
  if (!p) return;
  const o = origin(), s = 71 * o.U;
  const from = { ...pan };
  const to = { x: innerWidth / 2 - o.x - (p.c * s + 34 * o.U), y: innerHeight * 0.53 - o.y - (p.r * s + 34 * o.U) };
  const t0 = performance.now(), T = 700;
  cancelAnimationFrame(coast);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / T), e = 1 - (1 - k) ** 3;
    pan.x = from.x + (to.x - from.x) * e;
    pan.y = from.y + (to.y - from.y) * e;
    place();
    if (k < 1) coast = requestAnimationFrame(step); else after?.();
  };
  coast = requestAnimationFrame(step);
}

/* ---------- 모미 보기 ---------- */
world.addEventListener('click', (e) => {
  const b = e.target.closest('.momi');
  if (!b || moved) return;
  const it = items.find((x) => x.id === b.dataset.id);
  if (!it) return;
  snap(b, () => showCard(it));   // 찰칵 튀고 나서 글 카드
});
function showCard(it) {
  $('cardWho').textContent = it.name || '익명';
  const big = $('cardBig');
  big.className = `big ${it.shape}`;
  big.innerHTML = bigHTML(it);
  $('card').hidden = false;
  fitTri(big);
}
$('card').addEventListener('click', () => { $('card').hidden = true; });

/* ---------- 불러오기 ---------- */
async function refresh(first = false) {
  try {
    const r = await fetch(API);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (!d.enabled) { $('note').textContent = '지금은 모미를 저장할 수 없어요.'; return; }
    // 방금 내가 쓴 글이 아직 목록에 안 나왔으면 (몇 초 늦을 수 있음) 그대로 둠
    const got = new Set(d.items.map((x) => x.id));
    const pending = items.filter((x) => !got.has(x.id) && mine.includes(x.id));
    items = [...d.items].reverse().concat(pending);
    $('note').textContent = '';
    render();
  } catch {
    if (first) { $('note').textContent = '모미를 불러오지 못했어요. 새로고침해 주세요.'; render(); }
  }
  if (first) window.loaderReady?.(); // 로딩 화면 닫아도 됨
}
// 새 글 확인 (화면을 보고 있고, 쓰는 중이 아닐 때만)
setInterval(() => { if (!document.hidden && sheet.classList.contains('down')) refresh(); }, 30_000);

/* ---------- 쓰기 시트 ---------- */
const sheet = $('sheet'), text = $('text'), name = $('name'), sendBtn = $('send'), msg = $('msg');
let pick = { shape: 'triangle', color: 5 };   // 피그마 첫 화면: 세모 + 연두

SHAPES.forEach((s) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = s;
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', SHAPE_NAMES[s]);
  b.innerHTML = ICON_SVG[s];
  b.onclick = () => { pick.shape = s; update(); };
  $('shapes').append(b);
});
PALETTE.forEach((i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', COLOR_NAMES[i]);
  b.style.setProperty('--col', col(i));
  b.onclick = () => { pick.color = i; update(); };
  $('colors').append(b);
});

function update() {
  sheet.style.setProperty('--pick', col(pick.color));
  [...$('shapes').children].forEach((b, k) => b.setAttribute('aria-checked', String(SHAPES[k] === pick.shape)));
  [...$('colors').children].forEach((b, k) => b.setAttribute('aria-checked', String(PALETTE[k] === pick.color)));
  $('who').textContent = name.value.trim();
  const pv = $('preview');
  pv.innerHTML = `<div class="big ${pick.shape}">${bigHTML({ ...pick, text: text.value.trim(), at: null })}</div>`;
  fitTri(pv.firstElementChild);
  sendBtn.disabled = !text.value.trim();
}
text.addEventListener('input', () => { msg.textContent = ''; update(); });
name.addEventListener('input', update);
text.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); name.focus(); }
});

let posted = false;

// 체크 모션(약 1.5초) → 완료 알림(2.2초) → 알림이 사라지고 '모미 작성하기' 버튼이 다시 나옴
function celebrate(id) {
  world.querySelector(`[data-id="${id}"] .done`)?.classList.add('play');
  const toast = $('toast');
  setTimeout(() => {
    toast.classList.remove('bye');
    toast.hidden = false;
    setTimeout(() => {
      toast.classList.add('bye');
      setTimeout(() => {
        toast.hidden = true;
        posted = false;
        justPosted = null;
        // 알림과 함께 체크도 사라짐 → 판에는 모미만 남음
        const done = world.querySelector(`[data-id="${id}"] .done`);
        done?.classList.add('gone');
        setTimeout(() => done?.remove(), 400);
        if (sheet.classList.contains('down')) $('open').classList.remove('away');
      }, 350);
    }, 2200);
  }, 1500);
}
function openSheet() {
  $('card').hidden = true;
  sheet.inert = false;
  sheet.classList.remove('down');
  $('sheetDim').hidden = false;
  $('open').classList.add('away');
  msg.textContent = '';
  update();
}
function closeSheet() {
  document.activeElement?.blur();
  sheet.classList.add('down');
  sheet.inert = true;
  $('sheetDim').hidden = true;
  if (!posted) $('open').classList.remove('away');
}
// 모미 찰칵 모션 (style.css .momi.snap). 튀는 게 보이도록 다음 동작은 0.3초 뒤에
function snap(btn, then) {
  btn.classList.remove('snap');
  void btn.offsetWidth;          // 다시 재생되게
  btn.classList.add('snap');
  btn.addEventListener('animationend', () => btn.classList.remove('snap'), { once: true });
  if (then) setTimeout(then, 300);
}
window.openSheet = openSheet;   // 안내 화면 버튼(intro.js)에서 씀
$('open').onclick = openSheet;
$('close').onclick = closeSheet;
$('sheetDim').onclick = closeSheet;

const ERRORS = {
  bad_word: '고운 말로 다시 써 주세요 🙂',
  too_fast: '조금 뒤에 다시 남겨 주세요.',
  empty: '하고 싶은 일을 적어 주세요.',
  input: '모양과 색을 골라 주세요.',
  no_store: '지금은 모미를 저장할 수 없어요.',
};

sheet.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (sendBtn.disabled) return;
  sendBtn.disabled = true;
  msg.textContent = '';
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.value, name: name.value, shape: pick.shape, color: pick.color }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      msg.textContent = ERRORS[d.error] || '남기지 못했어요. 다시 시도해 주세요.';
      sendBtn.disabled = false;
      return;
    }
    // 피그마 11 → 10 → 9: 시트가 내려가고 판 가운데로 내 모미가 옴 → 체크가 그려짐 → '작성 완료' 알림 → 다시 판
    rememberMine(d.item.id);
    justPosted = d.item.id;
    posted = true;
    items.push(d.item);
    text.value = '';
    closeSheet();
    render();
    glideTo(d.item.id, () => celebrate(d.item.id));
  } catch {
    msg.textContent = '인터넷 연결을 확인해 주세요.';
    sendBtn.disabled = false;
  }
});

update();
refresh(true);
