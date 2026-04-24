(function () {
  'use strict';

  const canvas = document.getElementById('gameCanvas');

  const config = {
    type: Phaser.CANVAS,
    canvas: canvas,
    width: canvas.width,
    height: canvas.height,
    backgroundColor: '#000',
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload, create, update }
  };

  new Phaser.Game(config);

  let player, enemies, bullets, enemyBullets, powerUps;
  let cursors, keys, spaceKey;
  let score = 0;
  let lives = 3;
  let gameOver = false;
  let shootCooldown = 0;
  let spawnTimer = 0;
  let difficultyTimer = 0;

  function preload() {
    this.load.image('bg', 'static/assets/background.png');

    // fallback-safe single load
    this.load.image('ship', 'https://labs.phaser.io/assets/sprites/player.png');
    this.load.image('enemy', 'https://labs.phaser.io/assets/sprites/ufo.png');
    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullets/bullet7.png');
  }

  function create() {
    const scene = this;

    // background
    scene.add.image(canvas.width / 2, canvas.height / 2, 'bg')
      .setDisplaySize(canvas.width, canvas.height);

    // player
    player = scene.physics.add.image(canvas.width / 2, canvas.height - 70, 'ship');
    player.setDisplaySize(60, 60);
    player.setCollideWorldBounds(true);

    enemies = scene.physics.add.group();
    bullets = scene.physics.add.group();
    enemyBullets = scene.physics.add.group();
    powerUps = scene.physics.add.group();

    cursors = scene.input.keyboard.createCursorKeys();
    keys = scene.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D
    });

    spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // collisions
    scene.physics.add.overlap(bullets, enemies, hitEnemy, null, scene);
    scene.physics.add.overlap(player, enemies, hitPlayer, null, scene);
    scene.physics.add.overlap(player, enemyBullets, hitPlayer, null, scene);
    scene.physics.add.overlap(player, powerUps, collectPowerUp, null, scene);

    // UI
    scene.scoreText = scene.add.text(12, 12, '', { fontSize: '18px', fill: '#fff' });
    scene.livesText = scene.add.text(12, 35, '', { fontSize: '18px', fill: '#fff' });

    scene.gameOverText = scene.add.text(canvas.width / 2, canvas.height / 2, '', {
      fontSize: '40px',
      fill: '#ff4444',
      align: 'center'
    }).setOrigin(0.5);

    scene.input.keyboard.on('keydown-R', () => restart(scene));

    updateUI(scene);
    refreshLeaderboard();
  }

  function update(time, delta) {
    if (gameOver) return;

    const scene = this;

    // ======================
    // 🎮 DIAGONAL MOVEMENT
    // ======================
    const speed = 320;
    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown || keys.A.isDown) vx = -1;
    if (cursors.right.isDown || keys.D.isDown) vx = 1;
    if (cursors.up.isDown || keys.W.isDown) vy = -1;
    if (cursors.down.isDown || keys.S.isDown) vy = 1;

    player.setVelocity(vx * speed, vy * speed);

    // tilt effect
    player.setAngle(vx * 10);

    // ======================
    // 🔫 SHOOTING
    // ======================
    shootCooldown -= delta;
    if (spaceKey.isDown && shootCooldown <= 0) {
      shoot(scene);
      shootCooldown = 180;
    }

    // ======================
    // 👾 ENEMY SPAWN
    // ======================
    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnEnemy(scene);
      spawnTimer = Math.max(250, 900 - difficultyTimer * 10);
    }

    // ======================
    // 📈 DIFFICULTY INCREASE
    // ======================
    difficultyTimer += delta;

    // enemy shooting
    enemies.children.iterate(enemy => {
      if (enemy && Math.random() < 0.002) {
        enemyShoot(scene, enemy);
      }
    });

    // cleanup
    bullets.children.each(b => { if (b.y < -50) b.destroy(); });
    enemyBullets.children.each(b => { if (b.y > canvas.height + 50) b.destroy(); });
    enemies.children.each(e => { if (e.y > canvas.height + 50) e.destroy(); });

    updateUI(scene);
  }

  // ======================
  // 🔫 PLAYER SHOOT
  // ======================
function shoot(scene) {
  const bullet = bullets.create(player.x, player.y - 30, 'bullet');

  bullet.setVelocityY(-600);
  bullet.setScale(0.6);
  bullet.body.allowGravity = false;
  bullet.setCollideWorldBounds(false);
}

  // ======================
  // 👾 ENEMY SPAWN
  // ======================
function spawnEnemy(scene) {
  const x = Phaser.Math.Between(30, canvas.width - 30);

  const enemy = enemies.create(x, -40, 'enemy');

  enemy.setVelocityY(80 + score * 0.5);
  enemy.setDisplaySize(50, 50);
  enemy.setCollideWorldBounds(false);
  enemy.body.allowGravity = false;
}

  // ======================
  // 👾 ENEMY SHOOT
  // ======================
function enemyShoot(scene, enemy) {
  const bullet = enemyBullets.create(enemy.x, enemy.y + 20, 'bullet');

  bullet.setVelocityY(300);
  bullet.setTint(0xff4444);
  bullet.body.allowGravity = false;
}

  // ======================
  // 💥 HIT ENEMY
  // ======================
  function hitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;

    const scene = enemy.scene;

    const boom = scene.add.circle(enemy.x, enemy.y, 10, 0xffaa00);
    scene.tweens.add({
      targets: boom,
      scale: 3,
      alpha: 0,
      duration: 200,
      onComplete: () => boom.destroy()
    });

    bullet.destroy();
    enemy.destroy();

    score += 10;

    // chance to drop power-up
    if (Math.random() < 0.1) spawnPowerUp(scene, enemy.x, enemy.y);
  }

  // ======================
  // ❤️ PLAYER HIT
  // ======================
  function hitPlayer() {
    if (gameOver) return;

    lives -= 1;
    this.cameras.main.shake(150, 0.01);

    if (lives <= 0) {
      gameOver = true;
      this.gameOverText.setText(`GAME OVER\nScore: ${score}\nPress R`);
      submitScore(score);
    }
  }

  // ======================
  // ✨ POWERUPS
  // ======================
  function spawnPowerUp(scene, x, y) {
    const p = scene.add.circle(x, y, 8, 0x00ff88);
    scene.physics.add.existing(p);
    p.body.setVelocityY(120);
    powerUps.add(p);
  }

  function collectPowerUp(player, powerUp) {
    powerUp.destroy();
    score += 25;
    if (lives < 5) lives++;
  }

  // ======================
  // 🔁 RESET
  // ======================
  function restart(scene) {
    enemies.clear(true, true);
    bullets.clear(true, true);
    enemyBullets.clear(true, true);
    powerUps.clear(true, true);

    player.setPosition(canvas.width / 2, canvas.height - 70);

    score = 0;
    lives = 3;
    gameOver = false;
    shootCooldown = 0;
    spawnTimer = 0;

    scene.gameOverText.setText('');
    updateUI(scene);
  }

  // ======================
  // 📊 UI
  // ======================
  function updateUI(scene) {
    scene.scoreText.setText(`Score: ${score}`);
    scene.livesText.setText(`Lives: ${lives}`);
  }

  // ======================
  // 🌐 BACKEND
  // ======================
  function submitScore(value) {
    return fetch('/submit_score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time: value })
    });
  }

  function refreshLeaderboard(limit = 10) {
    fetch(`/api/leaderboard?limit=${limit}`)
      .then(r => r.json())
      .then(data => {
        const list = document.getElementById('leaderboardList');
        if (!list) return;
        list.innerHTML = '';
        data.forEach((row, i) => {
          const li = document.createElement('li');
          li.textContent = `${i + 1}. ${row.username} — ${row.time}`;
          list.appendChild(li);
        });
      });
  }

})();