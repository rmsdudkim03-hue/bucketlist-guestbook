/* 로딩 화면 (피그마 'iPhone 17 - 2·4·5', 402×874)
   도형이 바닥(그림자)에 한 번 튕기고, 다시 올라가는 동안 다음 도형으로 서서히 모양·색이 바뀜
   네모(연두) → 동그라미(주황) → 세모(초록) → 다시 네모 …
   - 세 도형을 한 번씩은 다 보여 준 뒤, 글을 다 불러오면 도형이 맨 위에 왔을 때 사라짐
   - 주소 끝에 #loader 를 붙이면 로딩 화면이 사라지지 않음 (모션 확인용)
   - 좌표 단위는 피그마 px (화면에선 --u 배로 커지고 작아짐). 도형 가운데 = (0, 0) */
(() => {
  const el = document.getElementById('loader');
  if (!el) return;
  const box = el.querySelector('.loader-shape');
  const path = el.querySelector('.loader-shape path');
  const shadow = el.querySelector('.loader-shadow');

  const T = 1300;          // 한 번 튕기는 데 걸리는 시간 (ms). 줄이면 빨라짐
  const MIN_BOUNCES = 3;   // 최소 튕기는 횟수 (세 도형을 한 번씩)
  const keep = location.hash === '#loader';
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 도형 (피그마 크기·색 그대로) ----------
     세 도형을 같은 개수(N)의 점으로 바꿔 두고, 점끼리 이어서 모양을 바꿈.
     점은 테두리를 따라 같은 간격으로 놓고, 바뀔 때는 서로 가장 가까운 점끼리 짝지어서 꼬이지 않게 함.
     모서리 둥글기(피그마 2px)는 선 두께로 냄: 점은 2px 안쪽, 같은 색 4px 선 */
  const N = 160;
  const R = 2;
  // 꼭짓점 목록 → 테두리를 따라 N개의 점 (시계 방향)
  function along(vs) {
    const segs = vs.map((v, i) => [v, vs[(i + 1) % vs.length]]);
    const lens = segs.map(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]));
    const total = lens.reduce((x, y) => x + y, 0);
    const out = [];
    let si = 0, acc = 0;
    for (let k = 0; k < N; k++) {
      const d = (k / N) * total;
      while (acc + lens[si] < d) acc += lens[si++];
      const [p, q] = segs[si], f = (d - acc) / lens[si];
      out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
    }
    return out;
  }
  const r = 31 - R;
  // 네모 62×62 (가운데 0,0)
  const square = along([[-r, -r], [r, -r], [r, r], [-r, r]]);
  // 동그라미 지름 67
  const circle = along(Array.from({ length: 96 }, (_, k) => {
    const a = (k / 96) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * (33.5 - R), Math.sin(a) * (33.5 - R)];
  }));
  // 세모 ◢ (피그마: 오른쪽 아래가 직각, 62 칸 안에서 왼쪽 위 2.8px 비움)
  const tip = -28.2 + R * 2.4;
  const triangle = along([[r, tip], [r, r], [tip, r]]);
  const SHAPES = [
    { pts: square, color: [0xe2, 0xf2, 0x68] },     // #E2F268
    { pts: circle, color: [0xe9, 0x88, 0x68] },     // #E98868
    { pts: triangle, color: [0x6d, 0xad, 0x93] },   // #6DAD93
  ];
  // 다음 도형의 점 순서를 돌려서, 지금 도형의 점과 가장 가깝게 짝지은 것 (꼬임 방지)
  const PAIR = SHAPES.map((from, i) => {
    const to = SHAPES[(i + 1) % 3].pts;
    let best = 0, bestD = Infinity;
    for (let o = 0; o < N; o++) {
      let d = 0;
      for (let k = 0; k < N; k++) {
        const q = to[(k + o) % N];
        d += (from.pts[k][0] - q[0]) ** 2 + (from.pts[k][1] - q[1]) ** 2;
      }
      if (d < bestD) { bestD = d; best = o; }
    }
    return { pts: to.map((_, k) => to[(k + best) % N]), color: SHAPES[(i + 1) % 3].color };
  });

  /* ---------- 움직임 ----------
     [시간(0~1), 높이(아래로 +, 69 = 바닥), 가로 크기, 세로 크기]
     바닥에 닿을 땐 도형 아래쪽을 기준으로 납작해짐 */
  const K = [
    [0.00, 0, 1.00, 1.00],
    [0.34, 69, 0.86, 1.18],   // 떨어지며 길쭉 → 바닥에 닿음
    [0.41, 69, 1.42, 0.60],   // 바닥에서 납작
    [0.49, 69, 0.92, 1.10],   // 다시 모이며
    [0.60, 30, 0.80, 1.28],   // 튀어 오르며 길쭉
    [0.78, -12, 1.08, 0.94],  // 제자리보다 살짝 더 올라가 퍼짐
    [0.90, 0, 0.98, 1.03],
    [1.00, 0, 1.00, 1.00],
  ];
  const EASE = [
    (t) => t * t,                       // 떨어질수록 빨라짐
    (t) => 1 - (1 - t) * (1 - t),
    (t) => t * t * (3 - 2 * t),
    (t) => 1 - (1 - t) ** 3,            // 올라갈수록 느려짐
    (t) => 1 - (1 - t) ** 2,
    (t) => t * t * (3 - 2 * t),
    (t) => t * t * (3 - 2 * t),
  ];
  const MORPH = [0.47, 0.86];           // 이 구간 동안 다음 도형으로 바뀜
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  function pose(t) {
    let i = 0;
    while (i < K.length - 2 && t > K[i + 1][0]) i++;
    const [t0, ...a] = K[i], [t1, ...b] = K[i + 1];
    const e = EASE[i](Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
    return a.map((v, j) => lerp(v, b[j], e));
  }

  function draw(from, to, m) {
    const p = from.pts.map(([x, y], k) => `${lerp(x, to.pts[k][0], m).toFixed(2)},${lerp(y, to.pts[k][1], m).toFixed(2)}`);
    path.setAttribute('d', `M${p.join('L')}Z`);
    const c = from.color.map((v, j) => Math.round(lerp(v, to.color[j], m)));
    path.setAttribute('fill', `rgb(${c})`);
    path.setAttribute('stroke', `rgb(${c})`);
  }

  let cur = 0, bounces = 0, ready = false, closing = false, start = performance.now();
  draw(SHAPES[0], SHAPES[0], 0);

  function frame(now) {
    if (closing) return;
    const t = (now - start) / T;
    if (t >= 1) {
      // 한 번 튕김 끝 (도형이 맨 위에 멈춘 순간)
      cur = (cur + 1) % 3;
      bounces++;
      if (ready && bounces >= MIN_BOUNCES && !keep) return close();
      start = now;
      return requestAnimationFrame(frame);
    }
    const next = PAIR[cur];
    const m = smooth(Math.min(1, Math.max(0, (t - MORPH[0]) / (MORPH[1] - MORPH[0]))));
    draw(SHAPES[cur], next, m);
    if (!still) {
      const [y, sx, sy] = pose(t);
      box.style.transform = `translateY(calc(var(--u) * ${y.toFixed(2)})) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      // 그림자: 바닥에 가까울수록 작고 진하게, 납작할 땐 옆으로 퍼짐
      const near = Math.max(0, Math.min(1, y / 69));
      shadow.style.transform = `scale(${(1.06 - 0.34 * near) * (0.75 + 0.25 * sx)}, ${1 - 0.15 * near})`;
      shadow.style.background = `rgb(${[230 - 22 * near, 229 - 22 * near, 230 - 22 * near].map(Math.round)})`;
      // 흐림: 맨 위에선 피그마 값(블러 10 ≈ 5px), 바닥에 닿을수록 선명하게(1px)
      shadow.style.filter = `blur(calc(var(--u) * ${(5 - 4 * near).toFixed(2)}))`;
    }
    requestAnimationFrame(frame);
  }

  function close() {
    closing = true;
    el.classList.add('out');
    // 로딩이 다 사라진 다음에 안내 화면 시작 (intro.js).
    // 겹치면 안내 문구의 연두 밑줄이 사라지는 네모 밑에서 선처럼 보였음
    setTimeout(() => {
      el.remove();
      window.dispatchEvent(new Event('loader:done'));
    }, 500);
  }

  // app.js가 글을 다 불러오면 부름
  window.loaderReady = () => { ready = true; };
  // 혹시 불러오기가 너무 오래 걸려도 8초 뒤엔 넘어감
  setTimeout(() => { ready = true; }, 8000);

  requestAnimationFrame(frame);
})();
