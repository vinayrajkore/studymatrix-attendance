const Jimp = require('jimp');
const path = require('path');

async function main() {
  const iconPath = path.join(__dirname, 'assets', 'images', 'icon.png');
  const outPath = path.join(__dirname, 'assets', 'images', 'icon-padded.png');
  
  const image = await Jimp.read(iconPath);
  const canvas = new Jimp(1024, 1024, 0x00000000); // 1024x1024 transparent
  
  image.resize(550, 550); // Scale down the logo to 550px so it fits safely inside the 66% safe zone of Adaptive Icons
  canvas.composite(image, 237, 237); // Center it: (1024 - 550) / 2 = 237
  
  await canvas.writeAsync(outPath);
  console.log('Padded icon saved to', outPath);
}
main().catch(console.error);
