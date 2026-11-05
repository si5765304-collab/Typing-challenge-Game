/* Typing Challenge: Bubbles + KeyMagnet
   Plain HTML5 / CSS3 / JavaScript (ES6+), no libraries. */
(function () {
  'use strict';

  /* =====================================================
     1. CONFIGURATION
     ===================================================== */

  // Mode A: Bubbles. Each level changes speed, bubble count, miss limit and penalty.
  const BUBBLE_LEVELS = {
    easy:   { label: 'Easy',   speed: 40, bubbles: 5, missLimit: 8, penalty: 1,
              blurb: 'Slow bubbles, 5 on screen, 8 misses allowed, a wrong key costs 1 point.' },
    medium: { label: 'Medium', speed: 60, bubbles: 6, missLimit: 6, penalty: 2,
              blurb: 'Faster bubbles, 6 on screen, 6 misses allowed, a wrong key costs 2 points.' },
    hard:   { label: 'Hard',   speed: 85, bubbles: 7, missLimit: 5, penalty: 3,
              blurb: 'Fast bubbles, 7 on screen, only 5 misses allowed, a wrong key costs 3 points.' }
  };
  const POP_POINTS = 10;   // points per popped bubble
  const LEVEL_EVERY = 5;   // every 5 pops the level goes up (faster + more bubbles)
  const SPAWN_GAP_MS = 450;

  // Mode B: KeyMagnet. Each level changes time limit, per-key limit, penalty, bonus and hint.
  const MAGNET_LEVELS = {
    easy:   { label: 'Easy',   time: 60, targetLimit: 0,   penalty: 0, fast: 1.0, bonus: 5,  hint: true,
              blurb: '60 seconds, no time limit per key, the target is highlighted on the keyboard, wrong keys cost nothing.' },
    medium: { label: 'Medium', time: 45, targetLimit: 3,   penalty: 2, fast: 1.0, bonus: 5,  hint: false,
              blurb: '45 seconds, 3 seconds per key, no hint, a wrong key costs 2 points, answer within 1 s for +5 bonus.' },
    hard:   { label: 'Hard',   time: 30, targetLimit: 1.5, penalty: 5, fast: 0.7, bonus: 10, hint: false,
              blurb: '30 seconds, only 1.5 seconds per key, no hint, a wrong key costs 5 points, answer within 0.7 s for +10 bonus.' }
  };
  const MAGNET_POINTS = 10;

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const KEY_SETS = {
    home:   { label: 'Home row',    keys: ['A', 'S', 'D', 'F', 'J', 'K', 'L'] },
    top:    { label: 'Top row',     keys: 'QWERTYUIOP'.split('') },
    bottom: { label: 'Bottom row',  keys: 'ZXCVBNM'.split('') },
    all:    { label: 'All letters', keys: ALPHABET }
  };
  const KB_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

  /* =====================================================
     2. DOM REFERENCES
     ===================================================== */
  const $ = (id) => document.getElementById(id);
  const els = {
    home: $('home'), game: $('game'), gameTitle: $('gameTitle'),
    arena: $('arena'), overlay: $('overlay'),
    targetKey: $('targetKey'), targetBar: $('targetBar'), targetFill: $('targetFill'),
    feedback: $('feedback'), keyboard: $('keyboard'), keyset: $('keyset'),
    st: {
      score: $('st-score'), diff: $('st-diff'),
      misses: $('st-misses'), level: $('st-level'), popped: $('st-popped'), wrong: $('st-wrong'),
      time: $('st-time'), correct: $('st-correct'), incorrect: $('st-incorrect'),
      avg: $('st-avg'), keyset: $('st-keyset')
    }
  };
  const keyEls = {}; // letter -> on-screen key button

  /* =====================================================
     3. SHARED STATE AND TIMER MANAGEMENT
     ===================================================== */
  let mode = null;            // 'bubbles' | 'magnet'
  let difficulty = 'easy';
  let keySetId = 'home';
  let playing = false;

  let rafId = 0;              // the ONLY animation loop (Bubbles)
  let tickId = 0;             // the ONLY interval (KeyMagnet)
  const pending = new Set();  // short feedback timeouts

  let B = null;               // Bubbles state
  let M = null;               // KeyMagnet state

  function later(fn, ms) {
    const id = setTimeout(() => { pending.delete(id); fn(); }, ms);
    pending.add(id);
    return id;
  }

  // Restart a CSS feedback class on an element for `ms` milliseconds.
  function flash(el, cls, ms) {
    el._flash = el._flash || {};
    if (el._flash[cls]) { clearTimeout(el._flash[cls]); pending.delete(el._flash[cls]); }
    el.classList.remove(cls);
    void el.offsetWidth; // restart CSS animation
    el.classList.add(cls);
    el._flash[cls] = later(() => el.classList.remove(cls), ms);
  }

  function clearFx() {
    els.arena.classList.remove('wrong', 'miss');
    els.targetKey.classList.remove('good', 'bad');
    Object.keys(keyEls).forEach((k) => keyEls[k].classList.remove('good', 'bad'));
  }

  // Stops every timer and animation loop. Called on end, restart, reset and going home.
  function stopAll() {
    playing = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (tickId) { clearInterval(tickId); tickId = 0; }
    pending.forEach(clearTimeout);
    pending.clear();
    clearFx();
  }

  /* =====================================================
     4. HOME SCREEN
     ===================================================== */
  function selectedDiff(m) {
    return document.querySelector('input[name="diff-' + m + '"]:checked').value;
  }

  function refreshBlurbs() {
    $('blurb-bubbles').textContent = BUBBLE_LEVELS[selectedDiff('bubbles')].blurb;
    const set = KEY_SETS[els.keyset.value];
    $('blurb-magnet').textContent = MAGNET_LEVELS[selectedDiff('magnet')].blurb +
      ' Key set: ' + set.label + ' (' + set.keys.length + ' keys).';
  }

  function openGame(m) {
    mode = m;
    difficulty = selectedDiff(m);
    keySetId = els.keyset.value;
    els.home.classList.add('hidden');
    els.game.classList.remove('hidden');
    els.game.dataset.mode = m;
    els.gameTitle.textContent = m === 'bubbles' ? 'Bubbles' : 'KeyMagnet';
    els.st.diff.textContent = (m === 'bubbles' ? BUBBLE_LEVELS : MAGNET_LEVELS)[difficulty].label;
    els.st.keyset.textContent = KEY_SETS[keySetId].label;
    resetGame(false);
    startGame();
  }

  function goHome() {
    stopAll();
    mode = null;
    els.overlay.classList.add('hidden');
    els.overlay.innerHTML = '';
    els.game.classList.add('hidden');
    els.home.classList.remove('hidden');
  }

  /* =====================================================
     5. GAME CONTROLS: start / restart / reset
     ===================================================== */
  function newBubbleState() {
    return {
      cfg: BUBBLE_LEVELS[difficulty],
      score: 0, popped: 0, wrong: 0, misses: 0, level: 1,
      bubbles: [], lastTs: 0, lastSpawn: 0, startedAt: 0
    };
  }

  function newMagnetState() {
    const cfg = MAGNET_LEVELS[difficulty];
    return {
      cfg, keys: KEY_SETS[keySetId].keys,
      score: 0, correct: 0, incorrect: 0, timeouts: 0,
      rtSum: 0, rtBest: null, target: null, shownAt: 0, endAt: 0
    };
  }

  // Puts everything back to zero. Does not start the game.
  function resetGame(showReadyOverlay) {
    stopAll();
    els.arena.innerHTML = '';
    els.overlay.innerHTML = '';
    els.overlay.classList.add('hidden');

    if (mode === 'bubbles') {
      B = newBubbleState();
      renderBubbleStatus();
    } else {
      M = newMagnetState();
      renderMagnetStatus();
      resetMagnetView();
    }
    if (showReadyOverlay) showReady();
  }

  function startGame() {
    stopAll();                                  // guarantees one loop only
    els.overlay.classList.add('hidden');
    els.overlay.innerHTML = '';
    if (mode === 'bubbles') startBubbles(); else startMagnet();
  }

  function restartGame() {
    resetGame(false);
    startGame();
  }

  function showReady() {
    const isB = mode === 'bubbles';
    const cfg = isB ? B.cfg : M.cfg;
    const how = isB
      ? 'Press the letter shown in a bubble to pop it. Do not let bubbles reach the top line.'
      : 'Press the key shown on the keycap. Your time and accuracy are tracked.';
    els.overlay.innerHTML =
      '<div class="panel"><h3>' + (isB ? 'Bubbles' : 'KeyMagnet') + ' (' + cfg.label + ')</h3>' +
      '<p>' + how + '</p><p>' + cfg.blurb + '</p>' +
      '<div class="actions"><button class="btn primary" data-act="start" type="button">Start</button></div></div>';
    els.overlay.classList.remove('hidden');
    focusPrimary();
  }

  function focusPrimary() {
    const b = els.overlay.querySelector('.primary');
    if (b) b.focus();
  }

  function saveBest(score) {
    const key = 'tcg-best-' + mode + '-' + difficulty + (mode === 'magnet' ? '-' + keySetId : '');
    let prev = 0;
    try { prev = Number(localStorage.getItem(key)) || 0; } catch (e) { /* storage blocked */ }
    const isNew = score > prev;
    if (isNew) { try { localStorage.setItem(key, String(score)); } catch (e) { /* ignore */ } }
    return { best: Math.max(prev, score), isNew: isNew };
  }

  function showResults(o) {
    els.overlay.innerHTML =
      '<div class="panel"><h3>' + o.title + '</h3><p>' + o.reason + '</p>' +
      '<div class="big-score"><span>' + o.score + '</span> points</div>' +
      '<p class="best">' + (o.isNew ? 'New best score!' : 'Best on this setting: ' + o.best) + '</p>' +
      '<dl class="stats">' +
      o.stats.map((s) => '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>').join('') +
      '</dl>' +
      '<div class="actions">' +
      '<button class="btn primary" data-act="restart" type="button">Play again</button>' +
      '<button class="btn" data-act="home" type="button">Change mode or settings</button>' +
      '</div></div>';
    els.overlay.classList.remove('hidden');
    focusPrimary();
  }

  /* =====================================================
     6. MODE A: BUBBLES
     ===================================================== */
  const bubbleSpeed = () => Math.min(B.cfg.speed * Math.pow(1.12, B.level - 1), B.cfg.speed * 3);
  const bubbleTarget = () => Math.min(10, B.cfg.bubbles + Math.floor((B.level - 1) / 2));

  function renderBubbleStatus() {
    const s = els.st;
    s.score.textContent = B.score;
    s.misses.textContent = B.misses + ' / ' + B.cfg.missLimit;
    s.level.textContent = B.level;
    s.popped.textContent = B.popped;
    s.wrong.textContent = B.wrong;
  }

  function place(b) {
    b.el.style.transform = 'translate(' + b.x + 'px,' + b.y + 'px)';
  }

  function pickLetter() {
    const free = ALPHABET.filter((l) => !B.bubbles.some((b) => b.letter === l));
    return free[Math.floor(Math.random() * free.length)];
  }

  function spawnBubble(y) {
    const w = els.arena.clientWidth;
    const size = w < 520 ? 48 : 60;
    const letter = pickLetter();
    let x = Math.random() * Math.max(1, w - size);
    for (let t = 0; t < 15; t++) {                 // try to avoid overlapping others
      const cx = Math.random() * Math.max(1, w - size);
      const clash = B.bubbles.some((o) => Math.abs(o.x - cx) < size + 8 && Math.abs(o.y - y) < size + 8);
      if (!clash) { x = cx; break; }
    }
    const el = document.createElement('div');
    el.className = 'bubble';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.fontSize = Math.round(size * 0.5) + 'px';
    const orb = document.createElement('span');
    orb.className = 'orb';
    orb.textContent = letter;
    el.appendChild(orb);
    el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); bubbleKey(letter); });

    const b = { el: el, letter: letter, x: x, y: y, size: size };
    els.arena.appendChild(el);
    B.bubbles.push(b);
    place(b);
  }

  function floatText(text, x, y, cls) {
    const f = document.createElement('div');
    f.className = 'float ' + cls;
    f.textContent = text;
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    els.arena.appendChild(f);
    later(() => f.remove(), 800);
  }

  function startBubbles() {
    B = newBubbleState();
    els.arena.innerHTML = '';
    playing = true;

    const n = B.cfg.bubbles;                        // at least 5 bubbles at once
    const h = els.arena.clientHeight;
    for (let i = 0; i < n; i++) spawnBubble(h * (0.25 + 0.65 * (i / (n - 1))));

    B.startedAt = Date.now();
    B.lastTs = performance.now();
    B.lastSpawn = B.lastTs;
    renderBubbleStatus();
    rafId = requestAnimationFrame(bubbleFrame);
  }

  function bubbleFrame(ts) {
    if (!playing || mode !== 'bubbles') return;
    const dt = Math.min((ts - B.lastTs) / 1000, 0.05);
    B.lastTs = ts;
    const speed = bubbleSpeed();
    const w = els.arena.clientWidth;
    const h = els.arena.clientHeight;

    for (let i = B.bubbles.length - 1; i >= 0; i--) {
      const b = B.bubbles[i];
      b.y -= speed * dt;
      if (b.x > w - b.size) b.x = Math.max(0, w - b.size);   // keep inside after resize
      if (b.y <= 0) missBubble(b, i); else place(b);
    }
    if (!playing) return;                                    // game ended inside missBubble

    if (B.bubbles.length < bubbleTarget() && ts - B.lastSpawn > SPAWN_GAP_MS) {
      spawnBubble(h);
      B.lastSpawn = ts;
    }
    rafId = requestAnimationFrame(bubbleFrame);
  }

  function missBubble(b, index) {
    B.bubbles.splice(index, 1);
    b.el.remove();
    B.misses++;
    floatText('Miss', b.x + b.size / 2, 14, 'bad');
    flash(els.arena, 'miss', 350);
    renderBubbleStatus();
    if (B.misses >= B.cfg.missLimit) endBubbles();
  }

  function bubbleKey(letter) {
    if (!playing || mode !== 'bubbles') return;
    const hit = B.bubbles.filter((b) => b.letter === letter).sort((a, b) => a.y - b.y)[0];
    const w = els.arena.clientWidth;
    const h = els.arena.clientHeight;

    if (hit) {
      B.bubbles.splice(B.bubbles.indexOf(hit), 1);
      hit.el.classList.add('pop');
      later(() => hit.el.remove(), 240);
      B.score += POP_POINTS;
      B.popped++;
      floatText('+' + POP_POINTS, hit.x + hit.size / 2, hit.y, 'good');

      const lvl = 1 + Math.floor(B.popped / LEVEL_EVERY);   // difficulty ramp
      if (lvl > B.level) {
        B.level = lvl;
        floatText('Level ' + lvl, w / 2, h / 2, 'info');
      }
    } else {
      B.wrong++;
      B.score = Math.max(0, B.score - B.cfg.penalty);       // penalty
      floatText('-' + B.cfg.penalty, w / 2, h / 2, 'bad');
      flash(els.arena, 'wrong', 300);
    }
    renderBubbleStatus();
  }

  function endBubbles() {
    stopAll();
    const attempts = B.popped + B.wrong;
    const acc = attempts ? Math.round((B.popped / attempts) * 100) : 0;
    const secs = Math.round((Date.now() - B.startedAt) / 1000);
    const best = saveBest(B.score);
    renderBubbleStatus();
    showResults({
      title: 'Game over',
      reason: 'You reached the limit of ' + B.cfg.missLimit + ' misses.',
      score: B.score, best: best.best, isNew: best.isNew,
      stats: [
        ['Difficulty', B.cfg.label], ['Level reached', B.level],
        ['Bubbles popped', B.popped], ['Bubbles missed', B.misses],
        ['Wrong keys', B.wrong], ['Accuracy', acc + '%'],
        ['Time survived', secs + ' s'], ['Penalty per wrong key', B.cfg.penalty]
      ]
    });
  }

  /* =====================================================
     7. MODE B: KEYMAGNET
     ===================================================== */
  function buildKeyboard() {
    els.keyboard.innerHTML = '';
    KB_ROWS.forEach((row) => {
      const r = document.createElement('div');
      r.className = 'kb-row';
      row.split('').forEach((ch) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'key';
        b.textContent = ch;
        b.tabIndex = -1;
        b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); magnetKey(ch); });
        keyEls[ch] = b;
        r.appendChild(b);
      });
      els.keyboard.appendChild(r);
    });
  }

  function renderMagnetStatus() {
    const s = els.st;
    s.score.textContent = M.score;
    s.correct.textContent = M.correct;
    s.incorrect.textContent = M.incorrect;
    s.avg.textContent = M.correct ? (M.rtSum / M.correct).toFixed(2) + 's' : '-';
    if (!playing) s.time.textContent = M.cfg.time + 's';
  }

  // Resets the keycap, bar, feedback line and keyboard highlights.
  function resetMagnetView() {
    els.targetKey.textContent = '?';
    els.feedback.className = 'feedback';
    els.feedback.textContent = 'Press the key shown on the keycap';
    els.targetFill.style.width = '100%';
    els.targetBar.classList.toggle('hidden', !M.cfg.targetLimit);
    els.st.time.parentNode.classList.remove('warn');
    Object.keys(keyEls).forEach((ch) => {
      const k = keyEls[ch];
      const inSet = M.keys.indexOf(ch) !== -1;
      k.classList.remove('hint');
      k.classList.toggle('in-set', inSet);
      k.classList.toggle('dim', !inSet);
    });
  }

  function startMagnet() {
    M = newMagnetState();
    resetMagnetView();
    playing = true;
    M.endAt = Date.now() + M.cfg.time * 1000;
    nextTarget();
    renderMagnetStatus();
    els.st.time.textContent = M.cfg.time + 's';
    tickId = setInterval(magnetTick, 50);
  }

  function nextTarget() {
    let k;
    do {
      k = M.keys[Math.floor(Math.random() * M.keys.length)];
    } while (k === M.target && M.keys.length > 1);
    M.target = k;
    M.shownAt = Date.now();
    els.targetKey.textContent = k;
    els.targetFill.style.width = '100%';
    Object.keys(keyEls).forEach((ch) => keyEls[ch].classList.remove('hint'));
    if (M.cfg.hint) keyEls[k].classList.add('hint');
  }

  function setFeedback(text, cls) {
    els.feedback.className = 'feedback ' + cls;
    els.feedback.textContent = text;
  }

  function magnetKey(letter) {
    if (!playing || mode !== 'magnet') return;
    const keyEl = keyEls[letter];
    if (letter === M.target) {
      const rt = (Date.now() - M.shownAt) / 1000;
      let pts = MAGNET_POINTS;
      if (rt <= M.cfg.fast) pts += M.cfg.bonus;              // speed bonus
      M.score += pts;
      M.correct++;
      M.rtSum += rt;
      if (M.rtBest === null || rt < M.rtBest) M.rtBest = rt;
      setFeedback('Correct! +' + pts + ' (' + rt.toFixed(2) + ' s)', 'good');
      flash(els.targetKey, 'good', 260);
      flash(keyEl, 'good', 260);
      nextTarget();
    } else {
      M.incorrect++;
      M.score = Math.max(0, M.score - M.cfg.penalty);        // penalty
      setFeedback('Wrong key: ' + letter + (M.cfg.penalty ? ' (-' + M.cfg.penalty + ')' : ''), 'bad');
      flash(els.targetKey, 'bad', 300);
      flash(keyEl, 'bad', 300);
    }
    renderMagnetStatus();
  }

  // Single interval: updates the countdown, the per-key bar and checks timeouts.
  function magnetTick() {
    if (!playing || mode !== 'magnet') return;
    const now = Date.now();
    const left = Math.max(0, M.endAt - now);
    const secs = Math.ceil(left / 1000);
    els.st.time.textContent = secs + 's';
    els.st.time.parentNode.classList.toggle('warn', secs <= 10);

    if (left <= 0) { endMagnet(); return; }

    const limit = M.cfg.targetLimit;
    if (limit) {
      const used = (now - M.shownAt) / 1000;
      els.targetFill.style.width = Math.max(0, 100 - (used / limit) * 100) + '%';
      if (used >= limit) {
        M.timeouts++;
        setFeedback('Too slow! The key was ' + M.target, 'bad');
        flash(els.targetKey, 'bad', 300);
        nextTarget();
        renderMagnetStatus();
      }
    }
  }

  function endMagnet() {
    stopAll();
    const attempts = M.correct + M.incorrect + M.timeouts;
    const acc = attempts ? Math.round((M.correct / attempts) * 100) : 0;
    const avg = M.correct ? (M.rtSum / M.correct).toFixed(2) + ' s' : '-';
    const fastest = M.rtBest !== null ? M.rtBest.toFixed(2) + ' s' : '-';
    const best = saveBest(M.score);
    renderMagnetStatus();
    els.st.time.textContent = '0s';
    showResults({
      title: 'Time is up',
      reason: 'Difficulty: ' + M.cfg.label + '. Key set: ' + KEY_SETS[keySetId].label + '.',
      score: M.score, best: best.best, isNew: best.isNew,
      stats: [
        ['Correct', M.correct], ['Incorrect', M.incorrect],
        ['Timeouts', M.timeouts], ['Accuracy', acc + '%'],
        ['Average response', avg], ['Fastest response', fastest]
      ]
    });
  }

  /* =====================================================
     8. EVENT WIRING
     ===================================================== */
  buildKeyboard();
  refreshBlurbs();

  document.querySelectorAll('.levels input').forEach((i) => i.addEventListener('change', refreshBlurbs));
  els.keyset.addEventListener('change', refreshBlurbs);

  $('start-bubbles').addEventListener('click', () => openGame('bubbles'));
  $('start-magnet').addEventListener('click', () => openGame('magnet'));
  $('btnHome').addEventListener('click', goHome);
  $('btnRestart').addEventListener('click', restartGame);
  $('btnReset').addEventListener('click', () => resetGame(true));

  // Buttons inside the overlay (Start, Play again, Change mode)
  els.overlay.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'start') startGame();
    else if (act === 'restart') restartGame();
    else if (act === 'home') goHome();
  });

  // Physical keyboard: one listener for both modes
  document.addEventListener('keydown', (ev) => {
    if (!playing || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key.length === 1 ? ev.key.toUpperCase() : '';
    if (!/^[A-Z]$/.test(k)) return;
    ev.preventDefault();
    if (mode === 'bubbles') bubbleKey(k); else magnetKey(k);
  });
})();
