const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to a common mobile landscape resolution
  await page.setViewportSize({ width: 926, height: 428 });

  await page.goto('file://' + process.cwd() + '/index.html');
  console.log('Page loaded');

  // Wait for Three.js to initialize
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'refinement_start.png' });

  // Move to Forest (SourceMachine)
  // Forest is at (-8, 0, -8). Let's simulate joystick movement.
  // We'll use page.evaluate to directly set player position for verification of interaction
  await page.evaluate(() => {
    const game = window.gameInstance; // I should expose the game instance or just use global scope if I can
    // Since I didn't expose gameInstance, I'll find the player via scene or just simulate joystick
  });

  // Actually, I'll just check if the progress bar on the Forest machine is moving.
  // The Forest machine is one of the machines in the game.

  // Wait to see if any items are produced
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'refinement_after_3s.png' });

  await browser.close();
})();
