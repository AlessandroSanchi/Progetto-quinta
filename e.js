(function(){
  'use strict';

  const canvas = document.getElementById('gameCanvas');

  const config = {
    type: Phaser.CANVAS,
    canvas: canvas,
    width: canvas.width,
    height: canvas.height,
    backgroundColor: '#000',
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: { preload, create, update }
  };

  new Phaser.Game(config);

  let player, enemies, bullets;
  let cursors, keys, spaceKey;
  let score = 0;
  let gameOver = false;
  let scoreSubmitted = false;
  let spawnTimer = 0;
  let shootCooldown = 0;

  function preload(){
    this.load.image('ship', 'static/assets/spaceship.png');
    this.load.image('enemy', 'static/assets/enemy.png'); // add one!
    this.load.image('bg', 'static/assets/background.png');

    // fallback test
    // this.load.image('ship', 'https://labs.phaser.io/assets/sprites/player.png');
    // this.load.image('enemy', 'https://labs.phaser.io/assets/sprites/ufo.png');
  }

  function create(){
    const scene = this;

    // background
    scene.add.image(canvas.width/2, canvas.height/2, 'bg')
      .setDisplaySize(canvas.width, canvas.height);

    // player
    player = scene.physics.add.image(canvas.width/2, canvas.height - 70, 'ship');
    player.setDisplaySize(70, 70);
    player.setCollideWorldBounds(true);

    enemies = scene.add.group();
    bullets = scene.add.group();

    // if enemy image wasn't provided on disk, create a simple placeholder texture
    if (!scene.textures.exists('enemy')){
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x00bbf9, 1);
      g.fillRect(0, 0, 50, 50);
      g.generateTexture('enemy_placeholder', 50, 50);
      g.destroy();
    }

    cursors = scene.input.keyboard.createCursorKeys();

    keys = scene.input.keyboard.addKeys({
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D
    });

    spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    scene.physics.add.overlap(bullets, enemies, hitEnemy, null, scene);
    scene.physics.add.overlap(player, enemies, hitPlayer, null, scene);

    scene.scoreText = scene.add.text(12, 12, 'Score: 0', {
      font: '20px Pharmakon',
      fill: '#fff'
    });

    scene.gameOverText = scene.add.text(canvas.width/2, canvas.height/2, '', {
      font: '40px Pharmakon',
      fill: '#ff5555'
    }).setOrigin(0.5);

    scene.input.keyboard.on('keydown-R', () => restart(scene));
    // populate leaderboard panel on load
    refreshLeaderboard();
  }

  function update(time, delta){
    if(gameOver) return;

    const speed = 350;
    player.setVelocityX(0);

    if (cursors.left.isDown || keys.A.isDown) {
      player.setVelocityX(-speed);
      player.setAngle(-10);
    }
    else if (cursors.right.isDown || keys.D.isDown) {
      player.setVelocityX(speed);
      player.setAngle(10);
    } else {
      player.setAngle(0);
    }

    // shooting
    shootCooldown -= delta;
    if(spaceKey.isDown && shootCooldown <= 0){
      shoot(this);
      shootCooldown = 200;
    }

    // spawn enemies
    spawnTimer -= delta/1000;
    if(spawnTimer <= 0){
      spawnEnemy(this);
      spawnTimer = 0.8;
    }

    // cleanup
    bullets.getChildren().forEach(b => { if(b.y < -20) b.destroy(); });
    enemies.getChildren().forEach(e => { if(e.y > canvas.height+20) e.destroy(); });

    this.scoreText.setText('Score: ' + score);
  }

  function shoot(scene){
    const bullet = scene.add.rectangle(player.x, player.y - 40, 6, 14, 0xffff00);
    scene.physics.add.existing(bullet);
    bullet.body.setVelocityY(-500);
    bullets.add(bullet);
  }

  function spawnEnemy(scene){
    const x = Phaser.Math.Between(30, canvas.width - 30);
    const key = scene.textures.exists('enemy') ? 'enemy' : 'enemy_placeholder';
    const enemy = scene.physics.add.image(x, -40, key);
    enemy.setDisplaySize(50, 50);

    enemy.body.setVelocityY(120 + score * 1.5);

    enemies.add(enemy);
  }

function hitEnemy(bullet, enemy){
  if (!bullet || !enemy) return;
  if (!bullet.active || !enemy.active) return;

  const scene = enemy.scene;

  // store position BEFORE destroying
  const x = enemy.x;
  const y = enemy.y;

  bullet.destroy();
  enemy.destroy();

  // 💥 explosion (safe)
  const boom = scene.add.circle(x, y, 10, 0xffaa00);

  scene.tweens.add({
    targets: boom,
    alpha: 0,
    scale: 3,
    duration: 200,
    onComplete: () => boom.destroy()
  });

  enemies.children.each(e => {
  if (e && !e.active) e.destroy();
  }, this);
  score += 10;
}

  function hitPlayer(){
    if (gameOver) return;
    gameOver = true;
    this.gameOverText.setText('GAME OVER\nPress R');
    // submit the player's score (backend expects a field named `time`)
    if (!scoreSubmitted) submitScore(score).then(() => { scoreSubmitted = true; refreshLeaderboard(); }).catch(()=>{});
  }

  function restart(scene){
    enemies.clear(true,true);
    bullets.clear(true,true);

    player.setPosition(canvas.width/2, canvas.height - 70);

    score = 0;
    gameOver = false;
    scoreSubmitted = false;

    scene.gameOverText.setText('');
  }

  // Send the current score to the backend. Backend uses the field name `time` for compatibility.
  function submitScore(value){
    return fetch('/submit_score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time: value })
    }).then(r => {
      if(!r.ok) throw r;
      return r.json();
    });
  }

  // Fetch leaderboard from backend and render into the page's <ol id="leaderboardList">
  function refreshLeaderboard(limit = 10){
    fetch(`/api/leaderboard?limit=${limit}`)
      .then(r => {
        if(!r.ok) throw new Error('Network response was not ok');
        return r.json();
      })
      .then(data => {
        const list = document.getElementById('leaderboardList');
        if(!list) return;
        list.innerHTML = '';
        data.forEach((row, idx) => {
          const li = document.createElement('li');
          li.textContent = `${idx + 1}. ${row.username} — ${row.time}`;
          list.appendChild(li);
        });
      })
      .catch(err => console.warn('Could not load leaderboard:', err));
  }

})();