#!/usr/bin/env node
/**
 * prebuild.mjs - 构建前自动注入版本号到文档
 * 
 * 从 package.json 读取版本号，替换文档中的占位符：
 * - {{APP_VERSION}} → 当前版本号 (如 "2.7.0")
 * - {{APP_VERSION_FULL}} → 带代号 (如 "v2.7.0 \"Project Nova\"")
 * - {{BUILD_DATE}} → 构建日期 (如 "2026-05-02")
 * - {{VERSION_HISTORY}} → 从 version.ts 的 VERSION_HISTORY 自动生成
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// 读取 package.json 获取版本
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
const version = pkg.version;
const buildDate = new Date().toISOString().split('T')[0];

// 读取 version.ts 获取代号和版本历史
const versionTsPath = resolve(ROOT, 'src/lib/core/version.ts');
const versionTs = readFileSync(versionTsPath, 'utf-8');

// 提取 APP_CODENAME
const codenameMatch = versionTs.match(/export const APP_CODENAME:\s*string\s*=\s*'([^']+)'/);
const codename = codenameMatch ? codenameMatch[1] : 'Unknown';

// 提取 VERSION_HISTORY - 找到数组开始位置，逐行解析到 ];
let versionHistoryMarkdown = '';
const arrayStartIdx = versionTs.indexOf('> = [');
if (arrayStartIdx !== -1) {
  const afterArray = versionTs.substring(arrayStartIdx + 5);
  const entries = afterArray.match(/\{\s*version:\s*'[^']+',\s*date:\s*'[^']+',\s*highlights:\s*\[[^\]]*\]\s*\}/g);
  if (entries) {
    versionHistoryMarkdown = entries.map(entry => {
      const vMatch = entry.match(/version:\s*'([^']+)'/);
      const dMatch = entry.match(/date:\s*'([^']+)'/);
      const hMatch = entry.match(/highlights:\s*\[([^\]]*)\]/);
      const v = vMatch ? vMatch[1] : '?';
      const d = dMatch ? dMatch[1] : '?';
      let highlights = '  - (无详情)';
      if (hMatch) {
        const items = hMatch[1].match(/'([^']*)'/g);
        if (items && items.length > 0) {
          highlights = items.map(h => `  - ${h.replace(/'/g, '')}`).join('\n');
        }
      }
      return `- **v${v}** (${d})\n${highlights}`;
    }).join('\n\n');
  }
}

// 占位符替换映射
const replacements = {
  '{{APP_VERSION}}': version,
  '{{APP_VERSION_FULL}}': `v${version} "${codename}"`,
  '{{BUILD_DATE}}': buildDate,
  '{{VERSION_HISTORY}}': versionHistoryMarkdown,
};

// 需要处理的文档文件
const docFiles = [
  'DEPLOYMENT.md',
  'ROADMAP.md',
  'docs/DEPLOYMENT.md',
  'docs/API.md',
];

let updatedCount = 0;

for (const filePath of docFiles) {
  const fullPath = resolve(ROOT, filePath);
  if (!existsSync(fullPath)) {
    console.log(`⚠️  跳过不存在的文件: ${filePath}`);
    continue;
  }

  let content = readFileSync(fullPath, 'utf-8');
  let changed = false;

  for (const [placeholder, value] of Object.entries(replacements)) {
    if (content.includes(placeholder)) {
      content = content.replaceAll(placeholder, value);
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ 已更新: ${filePath}`);
    updatedCount++;
  } else {
    console.log(`⏭️  无需更新: ${filePath} (无占位符)`);
  }
}

console.log(`\n📊 版本: v${version} "${codename}"`);
console.log(`📅 日期: ${buildDate}`);
console.log(`📝 版本历史条目: ${versionHistoryMarkdown ? (versionHistoryMarkdown.split('\n\n').length) : 0}`);
console.log(`📝 更新了 ${updatedCount} 个文件`);
