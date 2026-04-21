/* 
*/
(function(){
  'use strict';

  // Attach Phaser to the existing canvas element so its position/layout doesn't change
  const canvas = document.getElementById('gameCanvas');
  const width = (canvas && canvas.width) ? canvas.width : 900;
  const height = (canvas && canvas.height) ? canvas.height : 700;

  const config = {
    type: Phaser.CANVAS,
    canvas: canvas || undefined,
    width: width,
    height: height,
    backgroundColor: '#081018',
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: { preload, create, update }
  };

  const game = new Phaser.Game(config);

  // scene-scoped vars
  let player, enemiesGroup, bulletsGroup, cursors, keysObj, spawnTimer = 0;
  let started = false, startTime = 0, elapsed = 0, running = true;
  let timeStopped = false, elapsedAtStop = 0;
  let godMode = false;

  function preload() {
    // no external assets required for this basic boot
  }

  function create() {
    const scene = this;
    // ensure world bounds match canvas
    scene.physics.world.setBounds(0, 0, width, height);

    // player - visible rectangle with arcade body
    player = scene.add.rectangle(width/2, height/2, 30, 30, 0xff4444);
    scene.physics.add.existing(player);
    if (player.body) {
      player.body.setCollideWorldBounds(true);
      player.body.setBounce(0.1);
    }

    // input
    cursors = scene.input.keyboard.createCursorKeys();
    keysObj = scene.input.keyboard.addKeys({ W: Phaser.Input.Keyboard.KeyCodes.W, A: Phaser.Input.Keyboard.KeyCodes.A, S: Phaser.Input.Keyboard.KeyCodes.S, D: Phaser.Input.Keyboard.KeyCodes.D, P: Phaser.Input.Keyboard.KeyCodes.P, R: Phaser.Input.Keyboard.KeyCodes.R });

    // groups
    enemiesGroup = scene.add.group();
    bulletsGroup = scene.add.group();

    // overlaps
    scene.physics.add.overlap(player, enemiesGroup, (p, e)=> handlePlayerHit(scene, e));
    scene.physics.add.overlap(player, bulletsGroup, (p, b)=> handlePlayerHit(scene, b, true));

    // basic UI wiring (status/timer exist in DOM)
    const godCb = document.getElementById('godCheckbox'); if(godCb){ godCb.checked = godMode; godCb.addEventListener('change', (ev)=>{ godMode = !!ev.target.checked; const st = document.getElementById('status'); if(st) st.textContent = godMode ? 'GOD MODE' : ''; }); }
    const resetBtn = document.getElementById('resetBtn'); if(resetBtn) resetBtn.addEventListener('click', ()=>{ populateEnemies(scene); resetPlayer(scene); running = true; timeStopped = false; bulletsGroup.clear(true,true); const st = document.getElementById('status'); if(st) st.textContent = ''; });

    window.addEventListener('keydown', (e)=>{ const k = e.key; if(k==='p' || k==='P') toggleTimeStop(scene); if(k==='r' || k==='R') { populateEnemies(scene); resetPlayer(scene); running = true; timeStopped = false; bulletsGroup.clear(true,true); const st = document.getElementById('status'); if(st) st.textContent = ''; } });

    // initial populate
    populateEnemies(scene);
    resetPlayer(scene);
    // initial leaderboard load
    try{ updateLeaderboard(); } catch(e){}
    setInterval(()=>{ try{ updateLeaderboard(); }catch(e){} }, 5000);
  }

  function update(time, delta) {
    const scene = this;
    if(!running) return;
    const dt = Math.min(0.05, delta/1000);

    const speed = 220;
    if(player && player.body){
      player.body.setVelocity(0);
      if(cursors.left.isDown || (keysObj.A && keysObj.A.isDown)) player.body.setVelocityX(-speed);
      if(cursors.right.isDown || (keysObj.D && keysObj.D.isDown)) player.body.setVelocityX(speed);
      if(cursors.up.isDown || (keysObj.W && keysObj.W.isDown)) player.body.setVelocityY(-speed);
      if(cursors.down.isDown || (keysObj.S && keysObj.S.isDown)) player.body.setVelocityY(speed);
      if(!started && (player.body.velocity.x !== 0 || player.body.velocity.y !== 0)) { started = true; startTime = performance.now(); }
    }

    if(!timeStopped){
      spawnTimer -= dt;
      const spawnInterval = Math.max(0.5, 3 - elapsed/25);
      if(spawnTimer <= 0){
        const r = Math.random();
        if(r < 0.45) spawnEnemy(this, 'green');
        else if(r < 0.8) spawnEnemy(this, 'blue');
        else if(r < 0.95) spawnEnemy(this, 'red');
        else spawnEnemy(this, 'purple');
        spawnTimer = spawnInterval;
      }
    }

    updateEnemies(this, dt);
    updateBullets(this, dt);

    // Timer: accumulate elapsed seconds when the game has started and is not time-stopped.
    if (started) {
      if (!timeStopped) {
        elapsed += dt;
      }
      const tEl = document.getElementById('timer'); if (tEl) tEl.textContent = elapsed.toFixed(2);
    }
  }

  // --- helper functions (kept small and robust) ---
  function spawnEnemy(scene, type='green', minDist=140){
    const W = scene.sys.game.config.width; const H = scene.sys.game.config.height;
    const side = Math.floor(Math.random()*4);
    let x,y;
    const insideChance = 0.35;
    if(Math.random() < insideChance){
      if(side===0){ x = Math.random()*W; y = 10 + Math.random()*60; }
      else if(side===1){ x = W - (10 + Math.random()*60); y = Math.random()*H; }
      else if(side===2){ x = Math.random()*W; y = H - (10 + Math.random()*60); }
      else { x = 10 + Math.random()*60; y = Math.random()*H; }
    } else {
      if(side===0){ x = Math.random()*W; y = -30; }
      else if(side===1){ x = W + 30; y = Math.random()*H; }
      else if(side===2){ x = Math.random()*W; y = H + 30; }
      else { x = -30; y = Math.random()*H; }
    }

    let r = 18, speed = 60, color = 0x4caf50, shoot=false;
    if(type==='green'){ r = 20; speed = 60; color = 0x4caf50; }
    if(type==='blue'){ r = 10; speed = 160; color = 0x3aa0ff; }
    if(type==='red'){ r = 28; speed = 40; color = 0xd32f2f; }
    if(type==='purple'){ r = 16; speed = 50; color = 0x8e24aa; shoot = true; }

    const cx = W/2, cy = H/2; let dx0 = x - cx, dy0 = y - cy; let dist0 = Math.sqrt(dx0*dx0 + dy0*dy0) || 0.0001;
    if(dist0 < minDist){ let angle = Math.atan2(dy0, dx0); if(dist0 < 0.001) angle = Math.random()*Math.PI*2; x = cx + Math.cos(angle)*(minDist + 30 + Math.random()*60); y = cy + Math.sin(angle)*(minDist + 30 + Math.random()*60); }

    const targetX = W/2 + (Math.random()*200 - 100); const targetY = H/2 + (Math.random()*200 - 100);
    const dx = targetX - x; const dy = targetY - y; const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    const vx = (dx/dist) * speed; const vy = (dy/dist) * speed;

    const e = scene.add.circle(x, y, r, color);
    scene.physics.add.existing(e);
    if(e.body){ e.body.setCircle(r); e.body.setVelocity(vx, vy); e.body.setBounce(1,1); if(type==='blue') { e.body.setCollideWorldBounds(true); } }
    e.r = r; e.type = type; e.shootCooldown = Math.random()*2 + 1; e._color = color;
    enemiesGroup.add(e);
    return e;
  }

  function populateEnemies(scene){ enemiesGroup.clear(true,true); bulletsGroup.clear(true,true); for(let i=0;i<4;i++) spawnEnemy(scene,'green',140); for(let i=0;i<4;i++) spawnEnemy(scene,'blue',140); for(let i=0;i<3;i++) spawnEnemy(scene,'red',140); spawnEnemy(scene,'purple',140); }

  function resetPlayer(scene){ if(player && player.body){ player.x = scene.sys.game.config.width/2; player.y = scene.sys.game.config.height/2; player.body.setVelocity(0,0); } started = false; startTime = 0; elapsed = 0; const t = document.getElementById('timer'); if(t) t.textContent = '0.00'; spawnTimer = 0; }

  function handlePlayerHit(scene, entity, isBullet=false){
    if(godMode) return;
    if(started){
      const submitTime = timeStopped ? elapsedAtStop : elapsed;
      // submit score if positive
      if(typeof submitTime === 'number' && submitTime > 0){
        sendScore(submitTime);
      }
    }
    populateEnemies(scene);
    resetPlayer(scene);
    const st = document.getElementById('status'); if(st) st.textContent = isBullet ? 'Hit by bullet!' : 'Hit! Back to center.';
  }

  // Submit a score (time in seconds) to the server and refresh leaderboard on success
  function sendScore(timeVal){
    try{
      fetch('/submit_score', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: timeVal })
      }).then(r=>{
        if(r.ok) return r.json();
        throw new Error('submit failed');
      }).then(j=>{
        const st = document.getElementById('status'); if(st) st.textContent = 'Score saved!';
        updateLeaderboard();
      }).catch(err=>{
        const st = document.getElementById('status'); if(st) st.textContent = 'Could not submit score';
      });
    } catch(e){ /* ignore */ }
  }

  // Fetch leaderboard and populate #leaderboardList
  function updateLeaderboard(){
    fetch('/api/leaderboard?limit=10', { credentials: 'same-origin' }).then(r=>{
      if(!r.ok) throw new Error('failed');
      return r.json();
    }).then(data=>{
      const el = document.getElementById('leaderboardList');
      if(!el) return;
      el.innerHTML = '';
      data.forEach(row=>{
        const li = document.createElement('li');
        const time = (typeof row.time === 'number') ? row.time : parseFloat(row.time);
        li.textContent = `${row.username} — ${isNaN(time) ? row.time : time.toFixed(2)}s`;
        el.appendChild(li);
      });
    }).catch(()=>{});
  }

  function updateEnemies(scene, dt){ enemiesGroup.getChildren().forEach(e=>{
    if(e.type === 'green' && Math.random() < 0.005) { if(e.body){ e.body.velocity.x *= -1; e.body.velocity.y *= -1; } }
    if(e.type === 'blue'){ if(e.body){ if(e.x - e.r < 0 || e.x + e.r > scene.sys.game.config.width) e.body.velocity.x *= -1; if(e.y - e.r < 0 || e.y + e.r > scene.sys.game.config.height) e.body.velocity.y *= -1; } }
    if(e.type === 'red'){ if(e.x < -100 || e.x > scene.sys.game.config.width+100 || e.y < -100 || e.y > scene.sys.game.config.height+100){ const side = Math.floor(Math.random()*4); if(side===0){ e.x = Math.random()*scene.sys.game.config.width; e.y = -80; } else if(side===1){ e.x = scene.sys.game.config.width+80; e.y = Math.random()*scene.sys.game.config.height; } else if(side===2){ e.x = Math.random()*scene.sys.game.config.width; e.y = scene.sys.game.config.height+80; } else { e.x = -80; e.y = Math.random()*scene.sys.game.config.height; } } }
    if(e.type === 'purple' && !timeStopped){ e.shootCooldown -= dt; if(e.shootCooldown <= 0){ e.shootCooldown = 1.5 + Math.random()*1.2; const px = player.x; const py = player.y; const dx = px - e.x; const dy = py - e.y; const dist = Math.sqrt(dx*dx + dy*dy) || 1; const speed = 260; const b = scene.add.circle(e.x, e.y, 6, 0xb39ddb); scene.physics.add.existing(b); if(b.body){ b.body.setVelocity((dx/dist)*speed, (dy/dist)*speed); } bulletsGroup.add(b); } }
  }); }

  function updateBullets(scene, dt){ bulletsGroup.getChildren().forEach((b, idx)=>{ if(b.x < -50 || b.x > scene.sys.game.config.width+50 || b.y < -50 || b.y > scene.sys.game.config.height+50){ b.destroy(); } }); }

  function toggleTimeStop(scene){ /* simple toggle - freeze/unfreeze velocities */ const now = performance.now(); if(!timeStopped){ timeStopped = true; enemiesGroup.getChildren().forEach(e=>{ if(e.body){ e._vx = e.body.velocity.x; e._vy = e.body.velocity.y; e.body.setVelocity(0,0); } }); bulletsGroup.getChildren().forEach(b=>{ if(b.body){ b._vx = b.body.velocity.x; b._vy = b.body.velocity.y; b.body.setVelocity(0,0); } }); } else { timeStopped = false; enemiesGroup.getChildren().forEach(e=>{ if(e.body && typeof e._vx !== 'undefined'){ e.body.setVelocity(e._vx, e._vy); delete e._vx; delete e._vy; } }); bulletsGroup.getChildren().forEach(b=>{ if(b.body && typeof b._vx !== 'undefined'){ b.body.setVelocity(b._vx, b._vy); delete b._vx; delete b._vy; } }); } }

})();
