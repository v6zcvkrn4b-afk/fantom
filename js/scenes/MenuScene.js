import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

// Úvodní obrazovka
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, GAME_HEIGHT * 0.3, 'FANTOM', {
      fontFamily: 'Georgia, serif',
      fontSize: '120px',
      color: '#e5e7eb',
    }).setOrigin(0.5);

    this.add.text(cx, GAME_HEIGHT * 0.3 + 100, 'Dopadni ho, než zmizí', {
      fontFamily: 'Georgia, serif',
      fontSize: '36px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const start = this.add.text(cx, GAME_HEIGHT * 0.65, 'Klepni pro start', {
      fontFamily: 'sans-serif',
      fontSize: '44px',
      color: '#fbbf24',
    }).setOrigin(0.5);

    this.tweens.add({ targets: start, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => this.scene.start('Game'));
  }
}
