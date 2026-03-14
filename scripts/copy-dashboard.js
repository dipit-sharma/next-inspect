const fs = require("fs");
const path = require("path");

const sourceDir = path.resolve(__dirname, "../src/dashboard");
const targetDir = path.resolve(__dirname, "../dist/dashboard");

if (!fs.existsSync(sourceDir)) {
  process.stderr.write(`Dashboard source directory not found: ${sourceDir}\n`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });
