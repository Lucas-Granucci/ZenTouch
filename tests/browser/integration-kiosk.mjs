// Run against Vite and Firefox --headless --remote-debugging-port 9222.
// Uses Firefox's built-in WebDriver BiDi endpoint; no browser dependency is required.
import assert from 'node:assert/strict';
const ws = new WebSocket(process.env.ZENTOUCH_BIDI_URL ?? 'ws://127.0.0.1:9222/session');
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map(), errors = [];
ws.onmessage = e => {
  const message = JSON.parse(e.data);
  if (message.id) {
    const promise = pending.get(message.id); pending.delete(message.id);
    if (message.type === 'error') promise.reject(message); else promise.resolve(message.result);
  } else if (message.method === 'log.entryAdded' && message.params.level === 'error') errors.push(message.params);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params }));
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await send('session.new', { capabilities: { alwaysMatch: { acceptInsecureCerts: true } } });
  await send('session.subscribe', { events: ['log.entryAdded'] });
  const { context } = await send('browsingContext.create', { type: 'tab' });
  await send('browsingContext.setViewport', { context, viewport: { width: 1440, height: 1000 }, devicePixelRatio: 1 });
  const evaluate = async expression => {
    const result = await send('script.evaluate', { expression, target: { context }, awaitPromise: true });
    if (result.type === 'exception') throw result;
    return result.result.value;
  };
  const waitFor = async (expression, message) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(50); }
    throw new Error(message);
  };
  const button = id => `document.querySelector('[data-interaction-target="${id}"]')`;
  const present = id => waitFor(`!!${button(id)}`, `Missing target ${id}`);
  const click = async id => { await present(id); await evaluate(`${button(id)}.click()`); };
  const moveTo = async id => {
    await present(id);
    await evaluate(`(() => { const b = ${button(id)}; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:r.x+r.width/2,clientY:r.y+r.height/2})); })()`);
  };
  const url = process.env.ZENTOUCH_APP_URL ?? 'http://127.0.0.1:5173/';
  await send('browsingContext.navigate', { context, url: `${url}?input=simulated`, wait: 'complete' });
  await present('welcome-begin');
  assert.equal(await evaluate('document.querySelector(".operator-panel").hidden'), true);
  await moveTo('welcome-begin');
  await waitFor('!!document.querySelector(".soft-snap[data-positioned=true]")', 'Mouse dwell did not render glow');
  await present('restaurant-underground');
  await sleep(950);
  await click('restaurant-underground'); await present('menu-item-smash-burger');
  await click('menu-item-smash-burger'); await present('add-to-cart');
  assert.equal(await evaluate(`${button('add-to-cart')}.disabled`), true);
  await click('side-Sweet Potato Fries'); await click('item-qty-inc'); await click('add-to-cart');
  await present('place-order'); await click('place-order'); await present('done');
  await click('done'); await present('welcome-begin');
  console.log('PASS: simulated dwell, click/keyboard action path, disabled controls, full order and screen cleanup');

  await send('browsingContext.navigate', { context, url: `${url}?mode=operator&input=simulated`, wait: 'complete' });
  await present('welcome-begin');
  // Replay normalized landmarks at the camera-provider boundary, retaining the real
  // engine, registry, subscriptions, React controls and reducer. No real camera opens.
  await evaluate(`(async () => {
    const {CameraLandmarkProvider} = await import('/src/interaction/vision/CameraLandmarkProvider.ts');
    const prototype = CameraLandmarkProvider.prototype;
    const subscribe = prototype.subscribe, stop = prototype.stop;
    prototype.subscribe = function(listener) {
      (this.testListeners ??= new Set()).add(listener); const unsubscribe = subscribe.call(this, listener);
      return () => { this.testListeners.delete(listener); unsubscribe(); };
    };
    prototype.stop = function() { clearInterval(this.testTimer); this.testTimer = null; stop.call(this); };
    prototype.start = async function() {
      if (this.testTimer) return;
      this.testTimer = setInterval(() => {
        const b = document.querySelector('[data-interaction-target="' + window.testTarget + '"]');
        const r = b?.getBoundingClientRect();
        const x = r ? 1-(r.x+r.width/2)/innerWidth : .5;
        const cy = r ? (r.y+r.height/2)/innerHeight : .5, direction = cy < .5 ? -1 : 1;
        const y = cy-direction*.2;
        const landmarks = Array.from({length:21}, () => ({x,y,z:0}));
        landmarks[0] = {x,y:y-direction*.1,z:0}; landmarks[8] = {x,y:y+direction*.1,z:0};
        const frame = {timestamp:performance.now(),source:'camera',status:r?'tracking':'no-hand',imageSize:{width:640,height:480},previewMirrored:true,
          hands:r?[{id:'replay',handedness:'right',handednessConfidence:1,confidence:1,landmarks,worldLandmarks:null,elbow:null}]:[]};
        for (const listener of this.testListeners ?? []) listener(frame);
      }, 30);
    };
  })()`);
  const changeSource = async source => {
    await evaluate(`(() => { const select=document.querySelector('.operator-panel select'); select.value='${source}'; select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await sleep(200);
  };
  const cameraChoose = async (id, next) => {
    await present(id);
    await evaluate(`${button(id)}.scrollIntoView({block:'center'}); window.testTarget=${JSON.stringify(id)}`);
    await waitFor("[...document.querySelectorAll('.operator-panel [role=status]')].some(p=>p.textContent.includes('COOLDOWN'))", `Camera did not select ${id}`);
    await present(next);
    await evaluate('window.testTarget=null');
    await sleep(950);
  };
  await changeSource('camera');
  await evaluate('window.testTarget="welcome-begin"');
  await waitFor('!!document.querySelector("[data-interaction-target] .element-progress")', 'Camera did not begin progress');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-interaction-target] .element-progress")).transitionProperty'), '--element-progress');
  await evaluate('window.retainedCursor=document.querySelector(".soft-snap[data-tracking]"); window.testTarget=null');
  await waitFor('document.querySelector(".soft-snap[data-tracking]").dataset.tracking === "false"', 'Tracking did not pause');
  const frozenTransform = await evaluate('getComputedStyle(window.retainedCursor).transform');
  await sleep(350);
  assert.equal(await evaluate('getComputedStyle(window.retainedCursor).visibility'), 'visible');
  assert.equal(await evaluate('getComputedStyle(window.retainedCursor).transform'), frozenTransform);
  assert.equal(await evaluate('!!document.querySelector("[data-interaction-target] .element-progress")'), false);
  await evaluate('window.testTarget="welcome-begin"');
  await waitFor('document.querySelector(".soft-snap[data-tracking]").dataset.tracking === "true"', 'Tracking did not resume');
  assert.equal(await evaluate('window.retainedCursor === document.querySelector(".soft-snap[data-tracking]")'), true);
  assert.equal(await evaluate('getComputedStyle(window.retainedCursor).transitionProperty'), 'transform');
  console.log('PASS: cursor stays mounted and stationary through tracking loss, progress cancels, tracking resumes');
  await cameraChoose('welcome-begin', 'restaurant-underground');
  await cameraChoose('restaurant-underground', 'menu-item-smash-burger');
  await cameraChoose('menu-item-smash-burger', 'add-to-cart');
  await evaluate('window.testTarget="add-to-cart"'); await sleep(1400);
  assert.equal(await evaluate(`${button('add-to-cart')}.disabled`), true);
  await evaluate('window.testTarget=null');
  // Settings replace the engine without resetting the item customization screen.
  await evaluate(`(() => {const select=[...document.querySelectorAll('.operator-panel select')].find(s=>[...s.options].some(o=>o.value==='kalman')); select.value='kalman'; select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await sleep(200); await present('add-to-cart');
  await cameraChoose('side-Sweet Potato Fries', 'add-to-cart');
  await waitFor(`!${button('add-to-cart')}.disabled`, 'Camera did not choose side');
  await evaluate('window.testTarget=null'); await sleep(950);
  await cameraChoose('add-to-cart', 'place-order');
  // Switch modes with an existing cart and verify the mounted controls re-register.
  await changeSource('simulated'); await present('place-order');
  await changeSource('camera'); await present('place-order');
  await cameraChoose('place-order', 'done');
  await cameraChoose('done', 'welcome-begin');
  assert.deepEqual(errors, []);
  console.log('PASS: camera landmark replay through full kiosk, settings changes, provider switching with cart preserved, no browser errors');
  await send('browsingContext.close', { context });
} finally { await send('session.end').catch(() => {}); ws.close(); }
