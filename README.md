# Typing Challenge (Bubbles and KeyMagnet)

CSC336 Web Technologies, Lab Mid (Fall 2026), COMSATS University Islamabad, Vehari Campus.
Built by Muhammad Shoaib, FA24-BSE-116, Section B.

A responsive typing game made with plain HTML5, CSS3 and JavaScript (ES6+). No libraries, no build step.

## Run
Open `index.html` in any browser. Works on desktop and mobile (bubbles and on-screen keys are tappable).

## Demo video
<!-- Paste your Drive / YouTube link here -->

## Modes

### Mode A: Bubbles (letter recognition)
- 5 or more bubbles with letters rise at a controlled speed.
- Press the matching key to pop a bubble (+10 points).
- Wrong key: score penalty, red flash and shake.
- A bubble touching the red top line counts as a miss. The game ends at the miss limit.
- Difficulty ramps up during play: every 5 pops the level rises, bubbles get 12% faster and more bubbles appear.

| Level | Start speed | Bubbles | Miss limit | Wrong key penalty |
|-------|-------------|---------|-----------|-------------------|
| Easy | 40 px/s | 5 | 8 | -1 |
| Medium | 60 px/s | 6 | 6 | -2 |
| Hard | 85 px/s | 7 | 5 | -3 |

### Mode B: KeyMagnet (keyboard precision)
- A big target keycap and an on-screen keyboard. Targets come from a JavaScript array.
- Key sets: Home row (A S D F J K L), Top row, Bottom row, All letters. The set changes which keys can appear.
- Tracks correct, incorrect, timeouts and response time (average and fastest).
- Fast answers earn a speed bonus.

| Level | Game time | Time per key | Hint on keyboard | Wrong key penalty | Bonus |
|-------|-----------|--------------|------------------|-------------------|-------|
| Easy | 60 s | none | yes | 0 | +5 if under 1 s |
| Medium | 45 s | 3 s | no | -2 | +5 if under 1 s |
| Hard | 30 s | 1.5 s | no | -5 | +10 if under 0.7 s |

## Controls
- **Start**: begins the game (home screen button or the Start button after Reset).
- **Restart**: resets everything and starts again immediately.
- **Reset**: stops the game, zeroes everything and waits on the Ready screen.
- **Home**: back to mode selection. No page reload is used anywhere.

## Requirements checklist
- Home screen with name, description and Start button for each mode
- Easy / Medium / Hard that change real gameplay
- Score and status chips (score, misses, level, time left, correct, incorrect, average time, difficulty)
- Immediate correct / wrong feedback
- Results screen with statistics, plus best score saved in `localStorage`
- Full state reset on restart; only one `requestAnimationFrame` loop or one `setInterval` at a time, all cleared on end, restart, reset and home
- Responsive layout

## Files
- `index.html` structure
- `style.css` styling and animations
- `script.js` game logic
- `screenshots/` add your screenshots here
