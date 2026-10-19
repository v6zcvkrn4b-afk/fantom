import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

// Dočasná testovací hra na ověření, že dotyky fungují:
// klepni kamkoli a detektiv tam doběhne. Když se dotkne Fantoma, je dopaden.
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.caught = 0;

    this.detective = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.8, 'detective');
    this.phantom = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.25, 'phantom');
    this.phantom.setCollideWorldBounds(true).setBounce(1);
    this.movePhantom();

    this.scoreText = this.add.text(24, 24, 'Dopaden: 0×', {
      fontFamily: 'sans-serif',
      fontSize: '40px',
      color: '#e5e7eb',
    });

    this.target = null;
    this.input.on('pointerdown', (p) => { this.target = new Phaser.Math.Vector2(p.x, p.y); });
    this.input.on('pointermove', (p) => { if (p.isDown) this.target = new Phaser.Math.Vector2(p.x, p.y); });

    this.physics.add.overlap(this.detective, this.phantom, () => this.catchPhantom());
  }

  update() {
    if (!this.target) return;
    const dist = Phaser.Math.Distance.BetweenPoints(this.detective, this.target);
    if (dist < 10) {
      this.detective.body.reset(this.target.x, this.target.y);
      this.target = null;
    } else {
      this.physics.moveToObject(this.detective, this.target, 500);
    }
  }

  movePhantom() {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.phantom.setVelocity(Math.cos(angle) * 300, Math.sin(angle) * 300);
  }

  catchPhantom() {
    this.caught += 1;
    this.scoreText.setText(`Dopaden: ${this.caught}×`);
    this.cameras.main.flash(150, 251, 191, 36);
    this.phantom.setPosition(
      Phaser.Math.Between(80, GAME_WIDTH - 80),
      Phaser.Math.Between(80, GAME_HEIGHT / 2),
    );
    this.movePhantom();
  }
}
