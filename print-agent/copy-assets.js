const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'renderer');
const destDir = path.join(__dirname, 'dist', 'renderer');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = ['index.html', 'styles.css'];
for (const f of files) {
  const src = path.join(srcDir, f);
  const dest = path.join(destDir, f);
  fs.copyFileSync(src, dest);
  console.log(`Copied ${f}`);
}
