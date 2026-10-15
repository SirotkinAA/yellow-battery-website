
(() => {
const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.querySelector('.battery-anatomy').querySelector('#' + id);
const nf = (v, d = 0) => Number(v).toLocaleString('ru-RU', {minimumFractionDigits: d, maximumFractionDigits: d});
function tween(el, to, d = 0, dur = 450) {
  const from = el._v === undefined ? to : el._v; el._v = to;
  cancelAnimationFrame(el._r);
  if (RM || from === to) { el.textContent = nf(to, d); return; }
  const t0 = performance.now();
  const step = now => { let k = Math.min(1, (now - t0) / dur); k = 1 - Math.pow(1 - k, 3);
    el.textContent = nf(from + (to - from) * k, d); if (k < 1) el._r = requestAnimationFrame(step); };
  el._r = requestAnimationFrame(step);
}
function segInit(id, cb) {
  const el = $(id);
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); cb(b.dataset.v); });
}
function segSet(id, v) { $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === v))); }
function fill(r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); }
document.querySelectorAll('input[type=range]').forEach(r => { fill(r); r.addEventListener('input', () => fill(r)); });

/* ---------- HERO ---------- */
(function hero() {
  const svg = $('hero'); let s = '';
  s += `<rect class="term" x="96" y="26" width="46" height="34" rx="8"/><rect class="term" x="578" y="26" width="46" height="34" rx="8"/>`;
  s += `<text class="t2" x="119" y="18" text-anchor="middle" font-size="18" font-weight="700">−</text><text class="t2" x="601" y="18" text-anchor="middle" font-size="18" font-weight="700">+</text>`;
  s += `<rect class="lid" x="28" y="54" width="664" height="34" rx="12"/>`;
  s += `<rect class="case" x="40" y="80" width="640" height="232" rx="24"/>`;
  for (let i = 0; i < 6; i++) {
    const cx = 60 + i * 100;
    if (i < 5) s += `<rect class="wall" x="${cx + 98}" y="96" width="4" height="200" rx="2"/>`;
    s += `<rect class="acidf" x="${cx + 4}" y="112" width="90" height="184" rx="8"/>`;
    for (let p = 0; p < 9; p++) {
      const x = cx + 9 + p * 9.6;
      s += `<rect class="plate ${p % 2 ? 'pos' : 'neg'}" x="${x}" y="126" width="5.6" height="158" rx="2"/>`;
    }
    for (let b = 0; b < 6; b++) {
      const bx = cx + 14 + ((b * 37 + i * 13) % 70), by = 270 - (b % 3) * 30, r = 2 + (b % 3);
      s += `<circle class="bub" cx="${bx}" cy="${by}" r="${r}" style="animation-delay:${(b * 0.37 + i * 0.21) % 2.2}s"/>`;
    }
    if (i < 5) s += `<rect class="strap" x="${cx + 64}" y="100" width="72" height="9" rx="4.5"/>`;
    s += `<text class="t" x="${cx + 49}" y="342" text-anchor="middle" font-size="17" font-weight="700">2 В</text>`;
  }
  s += `<rect class="strap" x="110" y="58" width="18" height="51" rx="4"/><rect class="strap" x="592" y="58" width="18" height="51" rx="4"/>`;
  svg.innerHTML = s;
  const notes = {
    charged: 'На отрицательных пластинах чистый <b>свинец</b>, на положительных <b>двуокись свинца</b>. Между ними сепаратор с раствором серной кислоты. Шесть ячеек последовательно дают <b>12 В</b>.',
    discharge: 'При разряде на пластинах всегда образуется <b>сульфат свинца</b>, а в электролите — <b>вода</b>. Кислота уходит в пластины.',
    gas: 'При заряде сульфат возвращается в кислоту, но часть воды разлагается на <b>водород и кислород</b>. В конце заряда это происходит у любой свинцово-кислотной батареи.'
  };
  const dir = {charged: '⇄', discharge: '→', gas: '←'};
  const set = v => { svg.dataset.state = v; $('heroNote').innerHTML = notes[v]; $('heroDir').textContent = dir[v]; };
  segInit('heroSeg', set); set('charged');
})();

/* ---------- CONNECT ---------- */
(function connect() {
  const C = {n: 6, mode: 's'};
  const svg = $('conSvg');
  const defs = `<defs><linearGradient id="gCell" x1="0" x2="1"><stop offset="0" stop-color="var(--energy)"/><stop offset="1" stop-color="var(--energy-2)"/></linearGradient></defs>`;
  function cell(x, y, w, h) {
    const fs = Math.max(10, Math.min(15, Math.min(w / 3.2, h / 2.4)));
    return `<g><rect class="cell-body" x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(12, h / 3)}"/>` +
      `<rect x="${x + 3}" y="${y + 3}" width="${(w - 6) * 0.84}" height="${h - 6}" rx="${Math.min(9, (h - 6) / 3)}" fill="url(#gCell)"/>` +
      `<rect class="nub" x="${x + w}" y="${y + h * 0.3}" width="6" height="${h * 0.4}" rx="2"/>` +
      `<text class="t-cell" x="${x + (w - 6) * 0.42 + 3}" y="${y + h / 2 + fs * 0.36}" text-anchor="middle" font-size="${fs}">2 В</text></g>`;
  }
  function draw() {
    const N = C.n, ser = C.mode === 's'; let s = defs, wires = [];
    s += `<rect class="load" x="250" y="34" width="140" height="52" rx="14"/><text class="t" x="320" y="66" text-anchor="middle" font-size="16" font-weight="600">Нагрузка</text>`;
    let cells = '';
    if (ser) {
      const cw = Math.min(76, 520 / N - 8), h = 60, y = 190;
      const total = N * (cw + 8) - 2, x0 = (640 - total) / 2, xb = x0 + total;
      for (let i = 0; i < N; i++) cells += cell(x0 + i * (cw + 8), y, cw, h);
      wires.push(`M${x0} ${y + h / 2} H${x0 - 34} V60 H250`, `M390 60 H${xb + 34} V${y + h / 2} H${xb}`);
      cells += `<text class="t2" x="${x0 - 14}" y="${y - 10}" text-anchor="middle" font-size="18" font-weight="700">−</text><text class="t2" x="${xb + 14}" y="${y - 10}" text-anchor="middle" font-size="18" font-weight="700">+</text>`;
    } else {
      const h = Math.min(40, (196 - (N - 1) * 8) / N), total = N * h + (N - 1) * 8, y0 = 116 + (196 - total) / 2, cw = 240, x0 = 196;
      for (let i = 0; i < N; i++) { const y = y0 + i * (h + 8); cells += cell(x0, y, cw, h);
        wires.push(`M150 ${y + h / 2} H${x0}`, `M${x0 + cw + 6} ${y + h / 2} H490`); }
      const yl = y0 + (N - 1) * (h + 8) + h / 2;
      wires.push(`M150 ${yl} V60 H250`, `M390 60 H490 V${yl}`);
      cells += `<text class="t2" x="134" y="${y0 + h / 2 + 6}" text-anchor="middle" font-size="18" font-weight="700">−</text><text class="t2" x="506" y="${y0 + h / 2 + 6}" text-anchor="middle" font-size="18" font-weight="700">+</text>`;
    }
    s += wires.map(d => `<path class="wire" d="${d}"/>`).join('') + wires.map(d => `<path class="flow" d="${d}"/>`).join('') + cells;
    svg.innerHTML = s;
    const V = ser ? 2 * N : 2, Ah = ser ? 1 : N;
    tween($('conV'), V); tween($('conC'), Ah); $('conNo').textContent = N;
    $('conNote').innerHTML = ser
      ? `Минус первого — к плюсу второго. Напряжение <b>${N} × 2 В = ${V} В</b>, а ёмкость остаётся равной ёмкости одного элемента. ${N === 6 ? 'Это и есть моноблок 12 В.' : ''}`
      : `Минус к минусу, плюс к плюсу. Напряжение остаётся <b>2 В</b>, ёмкость растёт: <b>${N} × 1 А·ч</b>. Так ёмкость набирают и внутри элемента — числом пар пластин.`;
  }
  segInit('conMode', v => { C.mode = v; draw(); });
  $('conN').addEventListener('input', e => { C.n = +e.target.value; draw(); });
  draw();
})();

/* ---------- PEUKERT ---------- */
(function peukert() {
  const T = [5 / 60, 10 / 60, 15 / 60, 0.5, 1, 2, 3, 4, 5, 8, 10, 20];
  const I108 = [251.4, 183, 144, 89.7, 56.3, 34.6, 24.7, 20.0, 17.1, 11.7, 10.0, 5.30];
  const I96 = [318.7, 218, 168, 101, 61.8, 36.5, 26.0, 21.0, 18.0, 12.3, 10.2, 5.40];
  const Cap = T.map((t, i) => t * I108[i]), Cap96 = T.map((t, i) => t * I96[i]);
  function pchip(xs, ys) {
    const n = xs.length, h = [], d = [], m = [];
    for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    return x => { let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
      const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1]; };
  }
  const f = pchip(T.map(Math.log), Cap.map(Math.log)), f96 = pchip(T.map(Math.log), Cap96.map(Math.log));
  const lnMin = Math.log(5 / 60), lnMax = Math.log(20);
  const cap108 = t => Math.exp(f(Math.log(t)));
  const cap96 = t => Math.exp(f96(Math.log(t)));
  const P = {t: 1, end: '108'};
  const L = 52, R = 18, Tp = 16, B = 40, W = 640, H = 330;
  const X = t => L + (Math.log(t) - lnMin) / (lnMax - lnMin) * (W - L - R);
  const Y = c => Tp + (1 - c / 120) * (H - Tp - B);
  function fmtT(t) { if (t < 0.995) return Math.round(t * 60) + ' мин'; const hh = Math.floor(t + 1e-6), mm = Math.round((t - hh) * 60);
    return mm ? `${hh} ч ${mm} мин` : `${hh} ч`; }
  const svg = $('pkSvg');
  function curve(fn) { let d = ''; for (let i = 0; i <= 90; i++) { const lt = lnMin + (lnMax - lnMin) * i / 90, t = Math.exp(lt);
      d += (i ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(fn(t)).toFixed(1); } return d; }
  const base = (() => {
    let s = `<defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
    for (let c = 0; c <= 120; c += 20) s += `<line class="axis" x1="${L}" x2="${W - R}" y1="${Y(c)}" y2="${Y(c)}"/><text class="t3" x="${L - 10}" y="${Y(c) + 4}" text-anchor="end" font-size="12">${c}</text>`;
    [[5 / 60, '5 мин'], [0.25, '15 мин'], [1, '1 ч'], [5, '5 ч'], [20, '20 ч']].forEach(([t, l]) =>
      s += `<line class="axis" x1="${X(t)}" x2="${X(t)}" y1="${Tp}" y2="${H - B}" stroke-dasharray="2 4"/><text class="t3" x="${X(t)}" y="${H - B + 22}" text-anchor="middle" font-size="12">${l}</text>`);
    s += `<text class="t3" x="${L}" y="${Tp - 2}" font-size="12" dy="-2">А·ч</text>`;
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(100)}" y2="${Y(100)}" stroke="var(--fg-2)" stroke-width="1" stroke-dasharray="5 5"/><text class="t2" x="${L + 8}" y="${Y(100) - 8}" font-size="12" font-weight="600">номинал 100 А·ч</text>`;
    const c108 = curve(cap108);
    s += `<path d="${c108} L${X(20)} ${Y(0)} L${X(5 / 60)} ${Y(0)} Z" fill="url(#gArea)"/>`;
    s += `<path id="pk96" d="${curve(cap96)}" fill="none" stroke="var(--energy)" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`;
    T.forEach((t, i) => { s += `<circle cx="${X(t)}" cy="${Y(Cap96[i])}" r="3" fill="var(--energy)"/>`; });
    s += `<path id="pk108" d="${c108}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round"/>`;
    T.forEach((t, i) => { s += `<circle cx="${X(t)}" cy="${Y(Cap[i])}" r="4.5" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5"/>`;
      if ([1, 4, 8].includes(i)) s += `<text class="t" x="${X(t) + 10}" y="${Y(Cap[i]) + 20}" font-size="13" font-weight="700">${nf(Cap[i], 1)}</text>`; });
    s += `<text x="${W - R}" y="${Y(Cap96[11]) - 10}" text-anchor="end" font-size="12" font-weight="700" fill="var(--energy)" font-family="var(--font)">до 9,6 В</text><text x="${W - R}" y="${Y(Cap[11]) + 36}" text-anchor="end" font-size="12" font-weight="700" fill="var(--accent)" font-family="var(--font)">до 10,8 В</text>`;
    return s;
  })();
  function draw() {
    const fn = P.end === '108' ? cap108 : cap96, c = fn(P.t), I = c / P.t, x = X(P.t), y = Y(c);
    const col = P.end === '108' ? 'var(--accent)' : 'var(--energy)';
    const bx = Math.min(Math.max(x - 62, L + 4), W - R - 128);
    svg.innerHTML = base + `<line x1="${x}" x2="${x}" y1="${y}" y2="${H - B}" stroke="${col}" stroke-width="1.5"/>` +
      `<circle cx="${x}" cy="${y}" r="16" fill="${col}" opacity=".15"/><circle cx="${x}" cy="${y}" r="7.5" fill="${col}" stroke="var(--surface)" stroke-width="3"/>` +
      `<g transform="translate(${bx},${Math.max(y - 64, 2)})"><rect width="124" height="40" rx="12" fill="var(--fg)"/><text x="62" y="26" text-anchor="middle" font-size="15" font-weight="700" fill="var(--bg)" font-family="var(--font)">${nf(c, 1)} А·ч</text></g>`;
    $('pk108').setAttribute('opacity', P.end === '108' ? 1 : .35);
    $('pk96').setAttribute('opacity', P.end === '96' ? 1 : .45);
    tween($('pkI'), I, 1); tween($('pkC'), c, 1);
    $('pkTo').textContent = fmtT(P.t);
    $('pkBar').setAttribute('width', Math.max(10, Math.min(1, c / 100) * 608));
    $('pkBarTxt').textContent = `${nf(c, 1)} из 100 А·ч · ${nf(c, 0)} %`;
    let note;
    if (P.t < 0.3) note = `Короткий мощный разряд: <b>${nf(I, 0)} А</b> снимают всего ${nf(c, 1)} А·ч. Для 10 минут в таблице 183 А, это 30,5 А·ч. Короче 15 минут данные почти всегда расчётные.`;
    else if (P.t < 3) note = `Чтобы батарея продержалась ${fmtT(P.t)}, ток не должен превышать <b>${nf(I, 1)} А</b>. Из «100 А·ч» вы получите только ${nf(c, 0)}.`;
    else note = `Длинный разряд: ток <b>${nf(I, 1)} А</b>, батарея отдаёт почти всю ёмкость. Номинал 100 А·ч считается именно для 10 часов до 10,8 В, а за 20 часов она отдаст 106 А·ч.`;
    $('pkNote').innerHTML = note;
    document.querySelectorAll('#pkTicks .chip').forEach(ch => ch.classList.toggle('on', Math.abs(+ch.dataset.t - P.t) / P.t < 0.03));
  }
  const rng = $('pkT');
  const toT = v => Math.exp(lnMin + v / 1000 * (lnMax - lnMin));
  const toV = t => Math.round((Math.log(t) - lnMin) / (lnMax - lnMin) * 1000);
  rng.addEventListener('input', () => { P.t = toT(+rng.value); draw(); });
  $('pkTicks').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; P.t = +b.dataset.t; rng.value = toV(P.t); fill(rng); draw(); });
  segInit('pkEnd', v => { P.end = v; draw(); });
  rng.value = toV(1); fill(rng); draw();
})();

/* ---------- STRING ---------- */
(function str() {
  const S = {n: 20, st: new Array(40).fill(0), cap: 100};
  const svg = $('strSvg');
  const names = ['норма', 'КЗ ячейки', 'нагрев перемычки', 'обрыв'];
  function draw() {
    const N = S.n, cols = 10, rows = N / cols, bw = 44, bh = 56, step = 56, x0 = (640 - (cols * step - 12)) / 2, y0 = 48, rstep = 96;
    const lastBy = y0 + (rows - 1) * rstep, upsY = lastBy + bh + 44, H = upsY + 76;
    svg.setAttribute('viewBox', `0 0 640 ${H}`);
    let blocks = '', pts = [], open = -1;
    for (let k = 0; k < N; k++) {
      const r = Math.floor(k / cols), c = k % cols, col = r % 2 ? cols - 1 - c : c, dir = r % 2 ? -1 : 1;
      const bx = x0 + col * step, by = y0 + r * rstep, ty = by - 6;
      const L = [bx + 11, ty], Rr = [bx + bw - 11, ty];
      const entry = dir > 0 ? L : Rr, exit = dir > 0 ? Rr : L;
      pts.push(entry, exit);
      if (c === cols - 1 && k < N - 1) { const xo = dir > 0 ? bx + bw + 9 : bx - 9; pts.push([xo, ty], [xo, ty + rstep]); }
      const st = S.st[k]; if (st === 3 && open < 0) open = k;
      const lh = (bh - 10) * S.cap / 100;
      blocks += `<g class="blk s${st}" data-i="${k}" tabindex="0" role="button" aria-label="Моноблок ${k + 1}: ${names[st]}">` +
        `<ellipse class="halo" cx="${bx + bw / 2}" cy="${by + bh / 2}" rx="${bw / 2 + 6}" ry="${bh / 2 + 6}"/>` +
        `<rect class="term" x="${bx + 7}" y="${by - 6}" width="8" height="7" rx="2"/><rect class="term" x="${bx + bw - 15}" y="${by - 6}" width="8" height="7" rx="2"/>` +
        `<rect class="body" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="9"/>` +
        `<rect class="lvl" x="${bx + 5}" y="${by + bh - 5 - lh}" width="${bw - 10}" height="${lh}" rx="5"/>` +
        `<text class="num" x="${bx + bw / 2}" y="${by + 22}" text-anchor="middle">${st === 1 ? '10' : '12'}</text>` +
        `<line class="x" x1="${bx + 12}" y1="${by + 30}" x2="${bx + bw - 12}" y2="${by + bh - 8}"/><line class="x" x1="${bx + bw - 12}" y1="${by + 30}" x2="${bx + 12}" y2="${by + bh - 8}"/></g>`;
    }
    const first = pts[0], last = pts[pts.length - 1];
    let chain = 'M' + pts.map(p => p[0] + ' ' + p[1]).join(' L');
    const lead1 = `M232 ${upsY + 46} H16 V${y0 - 24} H${first[0]} V${first[1]}`;
    const lead2 = `M${last[0]} ${last[1]} V${lastBy - 26} H30 V${upsY + 20} H232`;
    const full = lead1 + ' ' + chain.replace('M', 'L') + ' ' + lead2.replace('M', 'L');
    const alive = open < 0;
    let s = `<defs><linearGradient id="gStr" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--energy)"/><stop offset="1" stop-color="var(--energy-2)"/></linearGradient></defs>`;
    s += `<path class="wire" d="${full}" style="stroke-width:2.5${alive ? '' : ';stroke:var(--bad);opacity:.5'}"/>`;
    if (alive) s += `<path class="flow" d="${full}" style="stroke-width:2.5"/>`;
    s += blocks;
    let V = 0, shorts = 0, hot = 0;
    for (let k = 0; k < N; k++) { const st = S.st[k]; V += st === 1 ? 10 : 12; if (st === 1) shorts++; if (st === 2) hot++; }
    s += `<rect class="ups" x="232" y="${upsY}" width="176" height="66" rx="16"/>` +
      `<text class="t" x="320" y="${upsY + 28}" text-anchor="middle" font-size="16" font-weight="700">ИБП</text>` +
      `<text class="t2" x="320" y="${upsY + 50}" text-anchor="middle" font-size="13" font-weight="500">${alive ? 'видит ' + V + ' В' : 'нагрузка сброшена'}</text>`;
    svg.innerHTML = s;
    const T = alive ? 30 * S.cap / 100 * (1 - shorts / (6 * N)) : 0;
    if (alive) tween($('strV'), V); else { cancelAnimationFrame($('strV')._r); $('strV')._v = 0; $('strV').textContent = '—'; }
    tween($('strT'), T, T < 10 && T > 0 ? 1 : 0);
    const pill = $('strPill');
    if (!alive) { pill.className = 'pill bad'; pill.textContent = 'Обрыв: ИБП бросил нагрузку'; }
    else if (hot) { pill.className = 'pill hot'; pill.textContent = 'Нагрев контакта: риск возгорания'; }
    else if (shorts) { pill.className = 'pill warn'; pill.textContent = 'Работает, неисправность скрыта'; }
    else { pill.className = 'pill ok'; pill.textContent = 'Нагрузка на батарее'; }
    let note;
    if (!alive) note = `Моноблок №${open + 1} в обрыве, и цепь из ${N} последовательных батарей разорвана целиком. <b>Резервного времени нет совсем.</b> Обрыв — самый критичный дефект: снаружи его не видно, а внутреннее сопротивление выдаёт его заранее.`;
    else if (hot) note = `Незатянутая перемычка: пятно контакта ухудшилось, и под нагрузкой место греется. В самой батарее гореть нечему, а изоляция перемычек горит прекрасно. <b>Тепловизор покажет такое место сразу.</b>`;
    else if (shorts) note = `${shorts === 1 ? 'Одна ячейка' : shorts + ' ячеек'} в КЗ: НРЦ такого моноблока не выше 11,0 В, а цепь просела на ${shorts * 2} В из ${N * 12}. Для ИБП это почти незаметно, зарядный ток через цепь течёт как прежде.`;
    else if (S.cap < 100) note = `Снижение ёмкости внешне не проявляется никак. Его последствие — <b>меньше резервного времени</b>: при ${S.cap} % ёмкости резерв сокращается примерно до ${nf(T, 0)} минут.`;
    else note = `Нажмите на любой моноблок, чтобы перебрать состояния: норма → КЗ ячейки → нагрев перемычки → обрыв.`;
    $('strNote').innerHTML = note;
    $('strCapO').textContent = S.cap + ' %';
  }
  function cycle(i) { S.st[i] = (S.st[i] + 1) % 4; draw(); const el = svg.querySelector(`[data-i="${i}"]`); if (el) el.focus({preventScroll: true}); }
  svg.addEventListener('click', e => { const g = e.target.closest('.blk'); if (g) cycle(+g.dataset.i); });
  svg.addEventListener('keydown', e => { const g = e.target.closest('.blk'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); cycle(+g.dataset.i); } });
  segInit('strN', v => { S.n = +v; draw(); });
  $('strCap').addEventListener('input', e => { S.cap = +e.target.value; draw(); });
  $('strReset').addEventListener('click', () => { S.st.fill(0); draw(); });
  $('strDemo').addEventListener('click', () => { S.st.fill(0); S.st[Math.floor(Math.random() * S.n)] = 3; draw(); });
  draw();
})();

/* ---------- RESISTANCE GAUGE ---------- */
(function gauge() {
  const svg = $('gSvg'), cx = 200, cy = 214, r = 160, MAX = 400;
  const pt = (p, rr) => { const a = Math.PI * (1 - p / MAX); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
  const arc = (p0, p1, rr) => { const [x0, y0] = pt(p0, rr), [x1, y1] = pt(p1, rr); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${rr} ${rr} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  let s = `<path d="${arc(0, MAX, r)}" fill="none" stroke="var(--seg)" stroke-width="22" stroke-linecap="round"/>`;
  s += `<path d="${arc(2, 148, r)}" fill="none" stroke="var(--ok)" stroke-width="22" stroke-linecap="round"/>`;
  s += `<path d="${arc(152, 298, r)}" fill="none" stroke="var(--warn)" stroke-width="22" stroke-linecap="round"/>`;
  s += `<path d="${arc(302, 398, r)}" fill="none" stroke="var(--bad)" stroke-width="22" stroke-linecap="round"/>`;
  [0, 100, 150, 300, 400].forEach(p => { const [x, y] = pt(p, r - 30); s += `<text class="t3" x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="600">${p}%</text>`; });
  s += `<g class="needle" id="gNeedle"><line x1="${cx}" y1="${cy}" x2="${cx - r + 40}" y2="${cy}" stroke="var(--fg)" stroke-width="4" stroke-linecap="round"/></g>`;
  s += `<circle cx="${cx}" cy="${cy}" r="11" fill="var(--fg)"/><circle cx="${cx}" cy="${cy}" r="4" fill="var(--surface)"/>`;
  s += `<text class="t" id="gPct" x="${cx}" y="${cy + 58}" text-anchor="middle" font-size="44" font-weight="700" letter-spacing="-1.5">125%</text>`;
  s += `<text class="t2" x="${cx}" y="${cy + 80}" text-anchor="middle" font-size="13" font-weight="500">от паспортного значения</text>`;
  s += `<text class="t3" x="${cx - r}" y="${cy + 34}" text-anchor="middle" font-size="12">норма</text><text class="t3" x="${cx + r}" y="${cy + 34}" text-anchor="middle" font-size="12">обрыв</text>`;
  svg.innerHTML = s;
  const pctEl = $('gPct');
  function draw() {
    const pass = +$('gPass').value, meas = +$('gMeas').value, low = $('gLow').checked;
    const eff = low ? meas / 1.15 : meas, p = eff / pass * 100, pc = Math.min(p, MAX);
    $('gPassO').textContent = nf(pass, 1) + ' мОм'; $('gMeasO').textContent = nf(meas, 1) + ' мОм';
    $('gNeedle').style.transform = `rotate(${pc / MAX * 180}deg)`;
    const fromV = pctEl._v === undefined ? p : pctEl._v; pctEl._v = p;
    const t0 = performance.now(); cancelAnimationFrame(pctEl._r);
    const step = now => { let k = RM ? 1 : Math.min(1, (now - t0) / 500); k = 1 - Math.pow(1 - k, 3); pctEl.textContent = nf(fromV + (p - fromV) * k, 0) + '%'; if (k < 1) pctEl._r = requestAnimationFrame(step); };
    pctEl._r = requestAnimationFrame(step);
    const col = p < 150 ? 'var(--ok)' : p < 300 ? 'var(--warn)' : 'var(--bad)';
    pctEl.style.fill = col;
    let v;
    if (p < 150) v = '<b>Первый диапазон учебной шкалы.</b> Сопротивление само по себе не определяет остаточную ёмкость. Сравнивайте результаты при одинаковых условиях измерения.';
    else if (p < 300) v = '<b>Рост сопротивления в учебном примере.</b> Причину и необходимость дальнейших испытаний определяют по документации и истории измерений.';
    else v = '<b>Высокое сопротивление в учебном примере.</b> Это повод для проверки батареи и соединений; шкала не устанавливает критерии допуска к эксплуатации.';
    $('gVerdict').innerHTML = v;
    $('gLowNote').innerHTML = low ? 'Учебное допущение: показание поделено на 1,15. Это не универсальная поправка между приборами и частотами.' : 'В этой модели сравнение выполняется на 1 кГц. Для реальной батареи используйте метод и частоту, указанные изготовителем.';
  }
  ['gPass', 'gMeas'].forEach(id => $(id).addEventListener('input', draw));
  $('gLow').addEventListener('change', draw);
  draw();
})();

/* ---------- FLOAT SPREAD ---------- */
(function flt() {
  const N = 30, MEAN = 13.62, LO = 12.9, HI = 14.3;
  const F = {v: [], sig: 0.08, drag: -1, newIdx: -1};
  const L = 46, R = 14, Tp = 18, B = 34, W = 640, H = 310;
  const X = i => L + (i + 0.5) * (W - L - R) / N;
  const Y = v => Tp + (HI - v) / (HI - LO) * (H - Tp - B);
  const svg = $('flSvg');
  function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function normalize() { const avg = F.v.reduce((a, b) => a + b, 0) / N; F.v = F.v.map(x => Math.min(HI - 0.03, Math.max(LO + 0.03, x - avg + MEAN))); }
  function gen() { F.v = Array.from({length: N}, () => MEAN + gauss() * F.sig); F.newIdx = -1; normalize(); draw(); }
  function setOne(i, val) {
    val = Math.min(HI - 0.03, Math.max(LO + 0.03, val));
    const delta = val - F.v[i]; F.v[i] = val;
    for (let k = 0; k < N; k++) if (k !== i) F.v[k] -= delta / (N - 1);
  }
  function draw() {
    let s = `<rect x="${L}" y="${Y(MEAN + 0.3)}" width="${W - L - R}" height="${Y(MEAN - 0.3) - Y(MEAN + 0.3)}" rx="8" fill="var(--ok)" opacity=".1"/>`;
    for (let v = 13.0; v <= 14.21; v += 0.2) s += `<line class="axis" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="t3" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="12">${nf(v, 1)}</text>`;
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(MEAN)}" y2="${Y(MEAN)}" stroke="var(--fg-2)" stroke-width="1.5" stroke-dasharray="5 5"/>`;
    s += `<text class="t2" x="${W - R}" y="${Y(MEAN + 0.3) - 7}" text-anchor="end" font-size="12" font-weight="600">среднее + 0,3 В</text><text class="t2" x="${W - R}" y="${Y(MEAN - 0.3) + 17}" text-anchor="end" font-size="12" font-weight="600">среднее − 0,3 В</text>`;
    let out = 0, maxd = 0;
    F.v.forEach((v, i) => {
      const d = v - MEAN, bad = Math.abs(d) > 0.3; if (bad) out++; maxd = Math.max(maxd, Math.abs(d));
      const col = bad ? 'var(--bad)' : 'var(--energy)';
      s += `<g class="lol" data-i="${i}"><rect x="${X(i) - 9}" y="${Tp}" width="18" height="${H - Tp - B}" fill="transparent"/>` +
        `<line x1="${X(i)}" x2="${X(i)}" y1="${Y(MEAN)}" y2="${Y(v)}" stroke="${col}" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="${X(i)}" cy="${Y(v)}" r="${F.drag === i ? 9 : 6.5}" fill="${col}" stroke="var(--surface)" stroke-width="2"/>` +
        (i === F.newIdx ? `<text class="t" x="${X(i)}" y="${Y(v) + (d > 0 ? -14 : 24)}" text-anchor="middle" font-size="11" font-weight="700">новая</text>` : '') + `</g>`;
      if ((i + 1) % 5 === 0 || i === 0) s += `<text class="t3" x="${X(i)}" y="${H - 12}" text-anchor="middle" font-size="12">${i + 1}</text>`;
    });
    if (F.drag >= 0) { const v = F.v[F.drag], x = Math.min(Math.max(X(F.drag), L + 40), W - R - 40);
      s += `<g transform="translate(${x - 38},${Math.max(Y(v) - 46, 0)})"><rect width="76" height="30" rx="9" fill="var(--fg)"/><text x="38" y="20" text-anchor="middle" font-size="13" font-weight="700" fill="var(--bg)" font-family="var(--font)">${nf(v, 2)} В</text></g>`; }
    svg.innerHTML = s;
    tween($('flMean'), MEAN, 2); tween($('flOut'), out);
    $('flOut').style.color = out ? 'var(--bad)' : '';
    let note = `Цепь: <b>${nf(MEAN * N, 1)} В</b> ÷ 30 = ${nf(MEAN, 2)} В на моноблок. Наибольшее отклонение — ${nf(maxd, 2)} В.`;
    if (F.newIdx >= 0) note = `Сценарий замены: одному моноблоку задано отличающееся напряжение, остальные перераспределяют напряжение цепи. Это иллюстрация дисбаланса. Решение о замене принимают по диагностике группы и документации производителя.`;
    else if (out) note += ` <b>${out} ${out === 1 ? 'моноблок' : out < 5 ? 'моноблока' : 'моноблоков'} вне учебной зоны</b> — требуется оценить причину разброса.`;
    else note += ' Все в учебной зоне ±0,3 В.';
    $('flNote').innerHTML = note;
    $('flSigO').textContent = '±' + nf(F.sig, 2) + ' В';
  }
  function valFromEvent(e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return p; }
  svg.addEventListener('pointerdown', e => { const g = e.target.closest('.lol'); if (!g) return; F.drag = +g.dataset.i; svg.setPointerCapture(e.pointerId); const p = valFromEvent(e);
    setOne(F.drag, HI - (p.y - Tp) / (H - Tp - B) * (HI - LO)); draw(); });
  svg.addEventListener('pointermove', e => { if (F.drag < 0) return; const p = valFromEvent(e); setOne(F.drag, HI - (p.y - Tp) / (H - Tp - B) * (HI - LO)); draw(); });
  const end = () => { if (F.drag >= 0) { F.drag = -1; draw(); } };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  $('flSig').addEventListener('input', e => { F.sig = +e.target.value; gen(); });
  $('flNew').addEventListener('click', gen);
  $('flRepl').addEventListener('click', () => { gen(); const i = 6 + Math.floor(Math.random() * 18); F.newIdx = i; setOne(i, MEAN + 0.42 * (Math.random() < .5 ? 1 : -1)); draw(); });
  gen();
})();

/* ---------- GAS ---------- */
(function gas() {
  const G = {type: 'open', n: 0.3, t: 2};
  const Q = {open: 3.0, vrla: 0.3};
  const conc = (t, q, n) => n > 0 ? q / n * (1 - Math.exp(-n * t)) : q * t;
  function tCross(q, n) { if (n > 0) { if (q / n <= 4) return Infinity; return -Math.log(1 - 4 * n / q) / n; } return 4 / q; }
  const room = $('gasRoom'), chart = $('gasChart');
  function drawRoom(c) {
    const danger = c >= 4, h = 26 + Math.min(c / 6, 1) * 120, op = Math.min(.12 + c / 4 * .5, .75);
    const col = danger ? 'var(--bad)' : 'var(--gas)';
    let s = `<defs><linearGradient id="gH2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="${op}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient>` +
      `<clipPath id="roomClip"><rect x="20" y="16" width="600" height="268" rx="20"/></clipPath></defs>`;
    s += `<rect x="20" y="16" width="600" height="268" rx="20" fill="var(--surface-2)" stroke="var(--line)" stroke-width="1.5"/>`;
    s += `<g clip-path="url(#roomClip)"><rect x="20" y="16" width="600" height="${h}" fill="url(#gH2)" style="transition:height .5s"/></g>`;
    s += `<text x="40" y="44" font-size="13" font-weight="700" fill="${col}" font-family="var(--font)">H₂ под потолком · ${nf(c, 1)} %</text>`;
    // fan
    s += `<g transform="translate(560,58)"><circle r="26" fill="var(--surface)" stroke="var(--line)" stroke-width="1.5"/><g class="fan" style="--fan:${G.n > 0 ? (1.6 / G.n).toFixed(2) + 's' : '0s'};${G.n > 0 ? '' : 'animation:none'}">` +
      [0, 120, 240].map(a => `<ellipse rx="6" ry="17" cy="-9" fill="var(--fg-3)" transform="rotate(${a})"/>`).join('') + `</g><circle r="4" fill="var(--fg-2)"/></g>`;
    s += `<text class="t3" x="560" y="104" text-anchor="middle" font-size="11">вытяжка</text>`;
    // rack
    s += `<rect x="70" y="250" width="420" height="6" rx="3" fill="var(--fg-3)"/><rect x="80" y="256" width="6" height="26" fill="var(--fg-3)"/><rect x="474" y="256" width="6" height="26" fill="var(--fg-3)"/>`;
    const nb = G.type === 'open' ? 18 : 3;
    for (let j = 0; j < 7; j++) {
      const x = 86 + j * 57;
      if (G.type === 'open') s += `<rect x="${x}" y="186" width="44" height="64" rx="6" fill="var(--acid)" stroke="var(--fg-3)" stroke-width="1.5"/><rect x="${x + 6}" y="194" width="32" height="50" rx="3" fill="none" stroke="var(--lead)" stroke-width="1" stroke-dasharray="3 3"/>`;
      else s += `<rect x="${x}" y="186" width="44" height="64" rx="8" fill="var(--surface)" stroke="var(--fg-2)" stroke-width="1.5"/><circle cx="${x + 22}" cy="182" r="4" fill="var(--fg-2)"/><text class="t3" x="${x + 22}" y="224" text-anchor="middle" font-size="10" font-weight="600">VRLA</text>`;
    }
    let bub = '';
    if (G.t > 0) for (let b = 0; b < nb; b++) {
      const x = 96 + ((b * 53) % 380), r = 2 + (b % 3), d = 2.6 + (b % 5) * .45, dl = (b * .31) % 2.6;
      bub += `<circle class="gbub" cx="${x}" cy="186" r="${r}" style="--d:${d}s;--dl:${dl}s"/>`;
    }
    s += bub;
    s += `<text class="t2" x="280" y="276" text-anchor="middle" font-size="12" font-weight="600">${G.type === 'open' ? 'открытые элементы: газ выходит свободно' : 'клапаны: выбросы на порядок меньше'}</text>`;
    room.innerHTML = s;
  }
  function drawChart() {
    const L = 46, R = 14, Tp = 12, B = 30, W = 640, H = 190, YM = 8;
    const X = t => L + t / 2 * (W - L - R), Y = c => Tp + (1 - Math.min(c, YM) / YM) * (H - Tp - B);
    const q = Q[G.type];
    let s = '';
    [0, 2, 4, 6, 8].forEach(c => s += `<line class="axis" x1="${L}" x2="${W - R}" y1="${Y(c)}" y2="${Y(c)}"/><text class="t3" x="${L - 8}" y="${Y(c) + 4}" text-anchor="end" font-size="12">${c}%</text>`);
    [0, 0.5, 1, 1.5, 2].forEach(t => s += `<text class="t3" x="${X(t)}" y="${H - 8}" text-anchor="middle" font-size="12">${t === 0 ? '0' : nf(t, t % 1 ? 1 : 0) + ' ч'}</text>`);
    s += `<rect x="${L}" y="${Y(YM)}" width="${W - L - R}" height="${Y(4) - Y(YM)}" fill="var(--bad)" opacity=".07"/>`;
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(4)}" y2="${Y(4)}" stroke="var(--bad)" stroke-width="1.5" stroke-dasharray="5 5"/><text x="${W - R}" y="${Y(4) - 7}" text-anchor="end" font-size="12" font-weight="700" fill="var(--bad)" font-family="var(--font)">4 % — гремучая смесь</text>`;
    let dAll = '', dNow = '';
    for (let i = 0; i <= 80; i++) { const t = 2 * i / 80, p = X(t).toFixed(1) + ' ' + Y(conc(t, q, G.n)).toFixed(1); dAll += (i ? 'L' : 'M') + p; if (t <= G.t + 1e-9) dNow += (i ? 'L' : 'M') + p; }
    s += `<path d="${dAll}" fill="none" stroke="var(--fg-3)" stroke-width="2" stroke-dasharray="3 5"/>`;
    if (dNow) s += `<path d="${dNow}" fill="none" stroke="var(--gas)" stroke-width="3.5" stroke-linecap="round"/>`;
    const c = conc(G.t, q, G.n);
    s += `<circle cx="${X(G.t)}" cy="${Y(c)}" r="7" fill="${c >= 4 ? 'var(--bad)' : 'var(--gas)'}" stroke="var(--surface)" stroke-width="3"/>`;
    chart.innerHTML = s;
  }
  function draw() {
    const q = Q[G.type], c = conc(G.t, q, G.n), tc = tCross(q, G.n);
    drawRoom(c); drawChart();
    tween($('gasC'), c, 1);
    $('gasNo').textContent = nf(G.n, 1) + ' обмена/ч'; $('gasTo').textContent = G.t < 1 ? Math.round(G.t * 60) + ' мин' : (Math.floor(G.t) + ' ч' + (Math.round((G.t % 1) * 60) ? ' ' + Math.round((G.t % 1) * 60) + ' мин' : ''));
    const tt = $('gasTT'), tu = $('gasTTu');
    if (!isFinite(tc) || tc > 24) { cancelAnimationFrame(tt._r); tt._v = undefined; tt.textContent = 'не достигается'; tu.textContent = ''; }
    else { cancelAnimationFrame(tt._r); tt._v = undefined; const hh = Math.floor(tc), mm = Math.round((tc - hh) * 60); tt.textContent = hh + ':' + String(mm).padStart(2, '0'); tu.textContent = 'ч'; }
    const pill = $('gasPill');
    if (c >= 4) { pill.className = 'pill bad'; pill.textContent = 'Взрывоопасная смесь'; }
    else if (c >= 2.5) { pill.className = 'pill warn'; pill.textContent = 'Близко к порогу'; }
    else { pill.className = 'pill ok'; pill.textContent = 'Ниже порога'; }
  }
  segInit('gasType', v => { G.type = v; draw(); });
  $('gasN').addEventListener('input', e => { G.n = +e.target.value; draw(); });
  $('gasT').addEventListener('input', e => { G.t = +e.target.value; draw(); });
  draw();
})();

/* ---------- LOAD TEST ---------- */
(function load() {
  const svg = $('ltSvg'), L = 48, R = 16, Tp = 14, B = 36, W = 640, H = 290, VMIN = 9, VMAX = 13;
  const Z = {span: 60, t: 0, running: false, done: false};
  const good = t => { const x = Math.min(t / 60, 1); return 12.25 - 0.65 * x - 2.0 * Math.pow(x, 12); };
  const bad = t => { const x = Math.min(t / 2, 1); return 12.15 - 0.55 * x - 2.0 * Math.pow(x, 5); };
  const Y = v => Tp + (VMAX - v) / (VMAX - VMIN) * (H - Tp - B);
  function draw() {
    const X = t => L + Math.min(t, Z.span) / Z.span * (W - L - R);
    let s = '';
    for (let v = 9; v <= 13; v++) s += `<line class="axis" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="t3" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="12">${v} В</text>`;
    const ticks = Z.span === 60 ? [0, 10, 20, 30, 40, 50, 60] : [0, 0.5, 1, 1.5, 2, 2.5, 3];
    ticks.forEach(t => s += `<text class="t3" x="${X(t)}" y="${H - 12}" text-anchor="middle" font-size="12">${Z.span === 60 ? t + ' мин' : (t ? nf(t, t % 1 ? 1 : 0) + ' мин' : '0')}</text>`);
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(9.6)}" y2="${Y(9.6)}" stroke="var(--bad)" stroke-width="1.5" stroke-dasharray="5 5"/><text x="${W - R}" y="${Y(9.6) + 18}" text-anchor="end" font-size="12" font-weight="700" fill="var(--bad)" font-family="var(--font)">9,6 В — порог примера</text>`;
    let d = ''; for (let i = 0; i <= 120; i++) { const t = Z.span * i / 120; d += (i ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(good(t)).toFixed(1); }
    s += `<path d="${d}" fill="none" stroke="var(--energy)" stroke-width="3" stroke-dasharray="7 6" opacity=".7"/>`;
    const gx = Z.span === 60 ? X(44) : X(2.3);
    s += `<text x="${gx}" y="${Y(good(Z.span === 60 ? 44 : 2.3)) - 12}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--energy)" font-family="var(--font)">исправная: 60 мин</text>`;
    if (Z.t > 0) { let b = ''; const n = 80; for (let i = 0; i <= n; i++) { const t = Z.t * i / n; b += (i ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(bad(t)).toFixed(1); }
      s += `<path d="${b}" fill="none" stroke="var(--bad)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += `<circle cx="${X(Z.t)}" cy="${Y(bad(Z.t))}" r="7" fill="var(--bad)" stroke="var(--surface)" stroke-width="3"/>`; }
    svg.innerHTML = s;
    const v = Z.t > 0 ? bad(Z.t) : 12.6, ah = 62 * Z.t / 60;
    const sec = Math.round(Z.t * 60); $('ltTime').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    $('ltV').textContent = nf(v, 1); $('ltAh').textContent = nf(ah, 1);
  }
  function run() {
    if (Z.running) return; Z.running = true; Z.t = 0; $('ltVerdict').hidden = true; $('ltRun').disabled = true;
    const dur = RM ? 0 : 4200, t0 = performance.now();
    const step = now => { const k = dur ? Math.min(1, (now - t0) / dur) : 1; Z.t = 2 * k; draw();
      if (k < 1) requestAnimationFrame(step);
      else { Z.running = false; Z.done = true; $('ltRun').disabled = false;
        const ah = 62 * 2 / 60;
        $('ltVerdict').innerHTML = `За 2 минуты батарея дошла до 9,6 В и отдала <b>${nf(ah, 1)} А·ч</b>, примерно в ${nf(67 / ah, 0)} раза меньше, чем показал индикатор. Вторая учебная кривая рассчитана на час работы. Отдаваемая ёмкость при постоянном токе: ток × время до заданного конечного напряжения.`;
        $('ltVerdict').hidden = false; } };
    requestAnimationFrame(step);
  }
  $('ltRun').addEventListener('click', run);
  $('ltReset').addEventListener('click', () => { if (Z.running) return; Z.t = 0; $('ltVerdict').hidden = true; draw(); });
  segInit('ltZoom', v => { Z.span = +v; draw(); });
  draw();
})();
})();
