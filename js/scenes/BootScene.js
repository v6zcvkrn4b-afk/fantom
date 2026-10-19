// Načítání obrázků, zvuků a dalších souborů. Zatím vytváří jen dočasnou grafiku.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Sem později přidáme skutečné soubory, např.:
    // this.load.image('detektiv', 'assets/images/detektiv.png');
    // this.load.audio('hudba', 'assets/audio/hudba.mp3');
  }

  create() {
    this.createPlaceholderTextures();
    this.scene.start('Menu');
  }

  // Dočasné tvary, dokud nebudou hotové skutečné obrázky
  createPlaceholderTextures() {
    const g = this.add.graphics();

    // Detektiv: modrý kruh s kloboukem
    g.fillStyle(0x3b82f6).fillCircle(40, 48, 32);
    g.fillStyle(0x1e293b).fillRect(14, 8, 52, 10).fillRect(24, 0, 32, 14);
    g.generateTexture('detective', 80, 80);
    g.clear();

    // Fantom: bílý duch s maskou
    g.fillStyle(0xe5e7eb).fillRoundedRect(8, 4, 64, 72, { tl: 32, tr: 32, bl: 4, br: 4 });
    g.fillStyle(0x111827).fillRect(16, 26, 48, 12);
    g.generateTexture('phantom', 80, 80);

    g.destroy();
  }
}
