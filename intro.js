/* 첫 안내 화면 2장 (로딩이 끝나면 시작)
   1) "여러분이 하고 싶은 일은 무엇인가요?" → '하고 싶은 일'에 형광펜 밑줄
   2) "여러분의 모미를 남겨주세요 !" → '모미'에 밑줄 → '모미 남기기' 버튼이 올라옴
   - 버튼을 누르면 쓰기 화면이 열리고, 안내 화면은 사라짐 (쓰기 화면을 닫으면 모두의 판)
   - 1번 화면에서 아무 데나 누르면 바로 2번으로
   - 주소 끝에 #intro 를 붙이면 로딩 없이 안내 화면부터 (모션 확인용) */
(() => {
  const el = document.getElementById('intro');
  if (!el) return;
  const s1 = el.querySelector('.s1'), s2 = el.querySelector('.s2'), go = document.getElementById('introGo');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let step = 0;

  async function show(p) {
    p.classList.add('show');
    await wait(500);          // 글이 나타난 뒤
    p.classList.add('line');  // 밑줄 긋기 (0.9초)
  }

  async function second() {
    if (step >= 2) return;
    step = 2;
    s1.classList.add('leave');
    await wait(500);
    await show(s2);
    await wait(1000);
    go.classList.add('show');
  }

  async function start() {
    if (step) return;
    step = 1;
    await show(s1);
    await wait(2200);         // 밑줄이 다 그어지고 잠깐 머문 뒤 다음 화면
    second();
  }

  el.addEventListener('click', (e) => { if (e.target !== go && step === 1) second(); });
  go.addEventListener('click', () => {
    // 찰칵 튀고 나서 쓰기 화면 열기 (app.js)
    window.snap(go, () => {
      el.classList.add('out');
      window.openSheet();
      setTimeout(() => el.remove(), 500);
    });
  });

  if (location.hash === '#intro') {
    document.getElementById('loader')?.remove();
    start();
  } else if (!document.getElementById('loader')) start();
  else window.addEventListener('loader:done', start, { once: true });
})();
