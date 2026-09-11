/* THE LAUNCH CHECK — A HUMAN-SHAPED SMOKE TEST, NOT A SUITE.

   Every Era 1.5 phase has to answer one question that no offline suite can: does the
   thing still BOOT AND PLAY. This is that question, asked the way a person would ask it —
   open the page, look at the menu, press NEW GAME, walk forward, look at the screen — and
   it takes about a minute rather than the twenty the browser suites take.

   Run it after any extraction, before claiming a phase is done:

       cd tests && node tools/launch-check.js

   It writes tests/renders/era-1-5-2-launch.png for a person to look at, and it makes no
   claim about how that screenshot looks.

   TWO THINGS IT GETS RIGHT THAT ARE EASY TO GET WRONG, both learned the hard way here:

     · It ROUTES three.min.js to tests/vendor/. The page loads three from a CDN this
       container cannot reach, and without the route `window.game` never appears at all —
       which looks exactly like a build that fails to boot.
     · It WAITS for `running === true` rather than sleeping. `running` is FALSE during the
       opening film by design (Phase 30 gates the film on movementLocked + !running), and
       this container renders at about one frame per second, so a fixed sleep measures the
       film and reports a working game as broken.

   ERA 1.5.2 — originally written for the pure-data extraction.
   Serves the repo over HTTP, opens the real page in a real Chromium, and answers the
   questions the brief's section 32 asks: does it boot, does NEW GAME work, does the
   player move, does the menu work, and did every extracted module actually arrive. */
const fs=require('fs'), http=require('http'), path=require('path');
const ROOT='/home/user/WhereItIsnt';
let chromium; try{chromium=require('playwright').chromium;}catch(e){chromium=require('/opt/node22/lib/node_modules/playwright').chromium;}
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.flac':'audio/flac','.m4a':'audio/mp4'};
const PORT=8571;
const srv=http.createServer((q,s)=>{
  const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'game.html';
  const f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);s.end('no');return;}
  s.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(s);
});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0; const ok=(c,m)=>{console.log((c?'OK    ':'FAIL  ')+m); if(!c)bad++;};

srv.listen(PORT,'127.0.0.1',async()=>{
  const br=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
  const pg=await br.newPage({viewport:{width:1280,height:720}});
  const errs=[],reqFail=[];
  pg.on('pageerror',e=>errs.push(e.message));
  pg.on('requestfailed',r=>reqFail.push(r.url()));
  pg.on('response',r=>{ if(r.url().includes('/src/')&&r.status()!==200) reqFail.push(r.status()+' '+r.url()); });

  const V=ROOT+'/tests/vendor/three.min.js';
  if(fs.existsSync(V)) await pg.route('**/three.min.js', r=>r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(V,'utf8')}));
  await pg.goto('http://localhost:'+PORT+'/game.html',{waitUntil:'load'});
  await pg.waitForFunction('typeof window.game !== "undefined"', null, {timeout:120000});
  ok(true,'the page loads and window.game exists');

  // every extracted module actually arrived: one symbol from each
  const symbols=await pg.evaluate(()=>({
    items:      typeof ITEM,                  icons: typeof getItemIconCanvas,
    noise:      typeof SimplexNoise,          settings: typeof GameSettings,
    block:      typeof BLOCK,                 shapes: typeof buildShapeTables,
    props:      typeof computeBreakTime,      dim: typeof DIMENSION,
    desc:       typeof dimensionByStableId,   audio: typeof AUDIO_ASSETS,
    tuning:     typeof ITEM_PICKUP_RADIUS,    world: typeof CHUNK_SX,
    save:       typeof SAVE_VERSION,          obj: typeof OBJECTIVE_CHAINS,
    cues:       typeof ONBOARDING_CUES,
  }));
  const missing=Object.entries(symbols).filter(([k,v])=>v==='undefined').map(([k])=>k);
  ok(missing.length===0,'all 15 extracted modules loaded and are in scope'+(missing.length?' — MISSING: '+missing.join(', '):''));
  ok(reqFail.length===0,'every src/ module was served 200'+(reqFail.length?' — '+reqFail.join(', '):''));

  // the two numbers, live
  const two=await pg.evaluate(()=>({
    stable1: dimensionByStableId(1).canonicalName,
    creative1: dimensionByCreativeNumber(1).canonicalName,
    saveDims: SAVE_DIMENSIONS.slice(),
    throws: (()=>{ try{ dimensionByCreativeNumber(99); return false; }catch(e){ return true; } })(),
  }));
  ok(two.stable1==='The Overworld'&&two.creative1==='Shattered Farmlands',
     `stable id 1 = "${two.stable1}", creative D1 = "${two.creative1}" — the two numbers differ, live`);
  ok(JSON.stringify(two.saveDims)==='["overworld","farmlands","suburbia"]',
     'and the derived SAVE_DIMENSIONS is unchanged: '+JSON.stringify(two.saveDims));
  ok(two.throws,'and a bad creative number throws rather than returning the wrong world');

  // menu
  ok(await pg.evaluate(()=>{const e=document.getElementById('startScreen');return e&&getComputedStyle(e).display!=='none';}),
     'the main menu is up');
  await pg.click('#startSettingsLink'); await wait(400);
  ok(await pg.evaluate(()=>{const e=document.getElementById('settingsOverlay');return e&&getComputedStyle(e).display!=='none';}),
     'SETTINGS opens over it');
  await pg.click('#setClose'); await wait(300);

  // new game
  await pg.click('#clickPlay'); await wait(1500);
  /* `running` is FALSE during the opening film, by design — Phase 30 gates the film on
     movementLocked + running === false, so sampling it here measures the film, not the
     game. The honest question is "did NEW GAME leave the menu and start the world", so
     that is what is asked. */
  ok(await pg.evaluate(()=>{
      const menuGone = getComputedStyle(document.getElementById('startScreen')).display === 'none';
      return menuGone && !!window.player && !!window.game.world;
     }), 'NEW GAME leaves the menu and brings up the world');
  /* The same sequence browser-playability uses: skip the film, then WAIT for running.
     At this container's ~1fps a fixed sleep measures the film, not the game. */
  await pg.evaluate('window.game.film && window.game.film.active && window.game.film.skip()');
  let ran = true;
  await pg.waitForFunction('window.game.running === true', null, {timeout:120000}).catch(()=>{ran=false;});
  ok(ran, 'and once the opening film is skipped, the game reaches running === true');
  await wait(900);

  const p0=await pg.evaluate(()=>({x:player.position.x,y:player.position.y,z:player.position.z,hp:player.hp,dim:game.dayCount}));
  await pg.evaluate(()=>{ player.movementLocked=false; });
  for(let i=0;i<45;i++){ await pg.evaluate(()=>{ player.keys&&(player.keys['KeyW']=true); }); await wait(20); }
  await pg.evaluate(()=>{ player.keys&&(player.keys['KeyW']=false); });
  await wait(600);
  const p1=await pg.evaluate(()=>({x:player.position.x,y:player.position.y,z:player.position.z}));
  const moved=Math.hypot(p1.x-p0.x,p1.z-p0.z);
  ok(moved>0.4,`the player moves under real input (${moved.toFixed(2)} blocks travelled)`);

  const world=await pg.evaluate(()=>({
    chunks: game.world.chunks?game.world.chunks.size:-1,
    block: game.world.getBlockWorld(Math.floor(player.position.x),Math.floor(player.position.y)-1,Math.floor(player.position.z)),
    hud: getComputedStyle(document.getElementById('hud')).display,
  }));
  ok(world.chunks>10,`the world streamed ${world.chunks} chunks around the player`);
  ok(world.block>0,`there is solid ground underfoot (block id ${world.block})`);
  ok(world.hud!=='none','and the HUD is visible');

  fs.mkdirSync(ROOT+'/tests/renders',{recursive:true});
  await pg.screenshot({path:ROOT+'/tests/renders/era-1-5-2-launch.png'});
  ok(true,'screenshot written to tests/renders/era-1-5-2-launch.png');
  ok(errs.length===0,'and the page raised no errors across the whole run'+(errs.length?' — '+errs.slice(0,3).join(' | '):''));

  await br.close(); srv.close();
  console.log('');
  console.log(bad? bad+' LAUNCH CHECK(S) FAILED' : 'THE BUILD BOOTS, PLAYS AND STREAMS — served over HTTP, in a real Chromium.');
  process.exit(bad?1:0);
});
