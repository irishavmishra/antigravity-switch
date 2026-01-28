import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pngFiles = [
    path.join(__dirname, '../src-tauri/icons/32x32.png'),
    path.join(__dirname, '../src-tauri/icons/128x128.png'),
];

const outputIco = path.join(__dirname, '../src-tauri/icons/icon.ico');

async function generateIco() {
    try {
        const buf = await pngToIco(pngFiles);
        fs.writeFileSync(outputIco, buf);
        console.log('✅ icon.ico generated successfully!');
    } catch (error) {
        console.error('❌ Failed to generate icon.ico:', error);
        process.exit(1);
    }
}

generateIco();
