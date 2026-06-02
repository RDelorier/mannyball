import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT=9350,HTTP_PORT=8140,URL=`http://localhost:${HTTP_PORT}/index.html`;
const server=spawn('node',['serve.js'],{env:{...process.env,PORT:String(HTTP_PORT)}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));await sleep(500);
const chrome=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,'--no-first-run','--user-data-dir=/tmp/__ipad_profile',URL]);
async function ws_(){for(let i=0;i<50;i++){try{const p=(await(await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t=>t.type==='page'&&t.webSocketDebuggerUrl);if(p)return p.webSocketDebuggerUrl;}catch{}await sleep(100);}throw new Error('no target');}
const ws=new WebSocket(await ws_());let id=0;const pending=new Map();const errs=[];
ws.onmessage=m=>{const x=JSON.parse(m.data);if(x.id&&pending.has(x.id)){pending.get(x.id)(x.result);pending.delete(x.id);}if(x.method==='Runtime.exceptionThrown')errs.push('EXC:'+(x.params.exceptionDetails.exception?.description||x.params.exceptionDetails.text));};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
await send('Runtime.enable');await send('Page.enable');
// iPad emulation: 820x1180 @ dpr2, touch.
await send('Emulation.setDeviceMetricsOverride',{width:820,height:1180,deviceScaleFactor:2,mobile:true});
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await send('Emulation.setEmitTouchEventsForMouse',{enabled:true,configuration:'mobile'});
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result?.value;
await send('Page.reload');await sleep(1300);
await ev(`document.getElementById('mode-select').value='2p';document.getElementById('difficulty-select').value='easy';document.getElementById('start-btn').click();true`);
await sleep(800);
if(await ev(`!document.getElementById('kickoff-choice').classList.contains('hidden')`)){await ev(`[...document.querySelectorAll('#kickoff-choice button')].find(b=>b.dataset.kick==='regular').click()`);await sleep(1500);}
for(let i=0;i<40;i++){if(await ev(`!document.getElementById('playcall').classList.contains('hidden')`))break;await sleep(250);}
await ev(`[...document.querySelectorAll('#playcall button')].find(b=>b.dataset.play==='pass').click();true`);
for(let i=0;i<20;i++){if(await ev(`!document.getElementById('timing-bar').classList.contains('hidden')`))break;await sleep(80);}
const before=await ev(`document.getElementById('timing-bar').classList.contains('hidden')`);
const dpr=await ev(`window.devicePixelRatio`);
const canvasBack=await ev(`(()=>{const c=document.getElementById('bar-canvas');return c.width+'x'+c.height;})()`);
// Tap to time via a touch on the game screen.
const rect=await ev(`(()=>{const r=document.getElementById('game-screen').getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()`);
const pt=JSON.parse(rect);
await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pt.x,y:pt.y}]});
await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await sleep(1500);
const msg=await ev(`document.getElementById('message').textContent`);
console.log('dpr:',dpr,'| canvas backing:',canvasBack,'| bar was visible:',!before);
console.log('tap-to-time resolved play ->',JSON.stringify(msg));
const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync('/tmp/mannyball_ipad.png',Buffer.from(shot.data,'base64'));
console.log('errors:',JSON.stringify(errs));
ws.close();chrome.kill();server.kill();process.exit(0);
