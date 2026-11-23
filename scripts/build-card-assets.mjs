import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const directory = new URL('../src/assets/cards/', import.meta.url);
const names = ['dragon', 'phoenix', 'dog', 'mahjong'];
const size = 384;
const tiles = await Promise.all(
  names.map(async (name, index) => ({
    input: await sharp(fileURLToPath(new URL(`source/${name}.png`, directory)))
      .resize(size, size, { fit: 'contain', background: '#00000000' })
      .png()
      .toBuffer(),
    left: (index % 2) * size,
    top: Math.floor(index / 2) * size,
  })),
);
await sharp({
  create: {
    width: size * 2,
    height: size * 2,
    channels: 4,
    background: '#00000000',
  },
})
  .composite(tiles)
  .webp({ quality: 85, alphaQuality: 100 })
  .toFile(fileURLToPath(new URL('specials.webp', directory)));
console.log('Built 2×2 special-card sprite: dragon, phoenix / dog, mahjong.');
for (const name of ['jack', 'queen', 'king']) {
  await sharp(fileURLToPath(new URL(`source/${name}.png`, directory)))
    .resize(256, 384, { fit: 'contain', background: '#00000000' })
    .webp({ quality: 85, alphaQuality: 100 })
    .toFile(fileURLToPath(new URL(`${name}.webp`, directory)));
}
console.log('Built jack, queen and king court illustrations.');
