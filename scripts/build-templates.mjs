import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesDir = path.join(__dirname, '..', 'templates');
const outputFile = path.join(__dirname, '..', 'src', 'templates.json');

// Read all .md files from templates directory
const templates = {};
const files = fs.readdirSync(templatesDir);

files.forEach(file => {
  if (file.endsWith('.md') && !file.toLowerCase().includes('readme')) {
    const name = file.replace('.md', '');
    const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
    templates[name] = content;
  }
});

// Write templates to JSON file
fs.writeFileSync(outputFile, JSON.stringify(templates, null, 2));
console.log(`Built ${Object.keys(templates).length} templates to src/templates.json`);