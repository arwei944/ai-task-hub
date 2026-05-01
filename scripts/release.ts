#!/usr/bin/env npx tsx
// ============================================================
// AI Task Hub - 完整版发布自动化脚本
// ============================================================
// 用法: npx tsx scripts/release.ts <version> [options]
//
// 选项:
//   --message <msg>    变更描述 (必需)
//   --type <type>      发布类型: major | minor | patch | prerelease (默认: auto)
//   --preid <id>       预发布标识: alpha | beta | rc (默认: 无)
//   --skip-tests       跳过测试
//   --skip-docs        跳过文档更新
//   --dry-run          只预览不执行
//   --push             推送到 GitHub (默认不推送)
//
// 示例:
//   npx tsx scripts/release.ts 2.0.0-beta.1 --message "需求分析模块" --push
//   npx tsx scripts/release.ts 2.0.0 --message "正式发布" --push
//   npx tsx scripts/release.ts 2.1.0 --message "新功能" --type minor --push
//
// 完整流程:
//   1. 验证工作区干净
//   2. 运行测试
//   3. 更新 package.json 版本
//   4. 更新 VERSION_HISTORY
//   5. 更新 CHANGELOG.md
//   6. 更新文档 (API.md, DEPLOYMENT.md)
//   7. Git 提交 + Tag
//   8. 推送到 GitHub (可选)
//   9. 创建 GitHub Release (可选)
// ============================================================

import { execSync, ExecSyncOptions } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

// ---- 常量 ----
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const PKG_PATH = resolve(ROOT, 'package.json');
const CHANGELOG_PATH = resolve(ROOT, 'CHANGELOG.md');
const VERSION_TS_PATH = resolve(ROOT, 'src/lib/core/version.ts');
const API_DOC_PATH = resolve(ROOT, 'docs/API.md');
const DEPLOY_DOC_PATH = resolve(ROOT, 'docs/DEPLOYMENT.md');

// ---- 颜色输出 ----
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(msg: string, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function step(n: number, total: number, msg: string) {
  log(`\n${colors.bold}[${n}/${total}] ${msg}${colors.reset}`);
}

function success(msg: string) {
  log(`  ✅ ${msg}`, colors.green);
}

function warn(msg: string) {
  log(`  ⚠️  ${msg}`, colors.yellow);
}

function error(msg: string) {
  log(`  ❌ ${msg}`, colors.red);
}

function info(msg: string) {
  log(`  ℹ️  ${msg}`, colors.cyan);
}

// ---- 工具函数 ----
function run(cmd: string, opts?: ExecSyncOptions): string {
  return (execSync(cmd, { encoding: 'utf-8', cwd: ROOT, stdio: 'pipe', ...opts }) as string).trim();
}

function pkg(): Record<string, any> {
  return JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
}

function writePkg(data: Record<string, any>) {
  writeFileSync(PKG_PATH, JSON.stringify(data, null, 2) + '\n');
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ---- 参数解析 ----
const args = process.argv.slice(2);
let targetVersion = '';
let message = '';
let prereleaseId = '';
let skipTests = false;
let skipDocs = false;
let dryRun = false;
let shouldPush = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--message': message = args[++i]; break;
    case '--type': /* handled below */ break;
    case '--preid': prereleaseId = args[++i]; break;
    case '--skip-tests': skipTests = true; break;
    case '--skip-docs': skipDocs = true; break;
    case '--dry-run': dryRun = true; break;
    case '--push': shouldPush = true; break;
    default:
      if (!args[i].startsWith('--') && !targetVersion) {
        targetVersion = args[i];
      }
  }
}

// ---- 版本号计算 ----
function computeVersion(current: string, type?: string, preid?: string): string {
  // 如果明确指定了版本号，直接使用
  if (targetVersion) {
    // 去掉 v 前缀
    let v = targetVersion.replace(/^v/, '');
    // 验证格式
    if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(v)) {
      error(`版本号格式错误: ${v}，应为 x.y.z 或 x.y.z-alpha.1`);
      process.exit(1);
    }
    return v;
  }

  // 自动计算
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    error(`当前版本号格式错误: ${current}`);
    process.exit(1);
  }

  let [major, minor, patch] = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];

  // 如果当前是预发布版本，发布同版本稳定版
  if (/-/.test(current) && !type) {
    return `${major}.${minor}.${patch}`;
  }

  switch (type || 'patch') {
    case 'major': return `${major + 1}.0.0${preid ? `-${preid}.1` : ''}`;
    case 'minor': return `${major}.${minor + 1}.0${preid ? `-${preid}.1` : ''}`;
    case 'patch': return `${major}.${minor}.${patch + 1}${preid ? `-${preid}.1` : ''}`;
    case 'prerelease': {
      const preMatch = current.match(/-(.+)\.(\d+)$/);
      if (preMatch && preMatch[1] === preid) {
        return `${major}.${minor}.${patch}-${preid}.${parseInt(preMatch[2]) + 1}`;
      }
      return `${major}.${minor}.${patch + 1}-${preid || 'alpha'}.1`;
    }
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

// ---- 主流程 ----
async function main() {
  const currentPkg = pkg();
  const currentVersion = currentPkg.version;

  log(`\n${colors.bold}🚀 AI Task Hub 发布工具${colors.reset}`);
  log(`${colors.cyan}当前版本: ${currentVersion}${colors.reset}`);

  // 计算新版本号
  const typeIdx = args.indexOf('--type');
  const releaseType = typeIdx >= 0 ? args[typeIdx + 1] : undefined;
  const newVersion = computeVersion(currentVersion, releaseType, prereleaseId);

  if (!message) {
    error('缺少变更描述，请使用 --message 参数');
    log(`\n用法: npx tsx scripts/release.ts <version> --message "变更描述" [--push]`);
    log(`示例: npx tsx scripts/release.ts 2.0.0-beta.1 --message "需求分析模块" --push`);
    process.exit(1);
  }

  const isPrerelease = /-/.test(newVersion);
  const totalSteps = 9;

  log(`${colors.bold}目标版本: ${newVersion}${isPrerelease ? ' (预发布)' : ' (正式)'}${colors.reset}`);
  log(`${colors.bold}变更描述: ${message}${colors.reset}`);

  if (dryRun) {
    warn('🔍 DRY RUN 模式 — 不会执行任何修改\n');
  }

  // ---- Step 1: 验证工作区 ----
  step(1, totalSteps, '验证工作区状态');
  try {
    const status = run('git status --porcelain');
    if (status) {
      error('工作区不干净，请先提交或暂存更改：');
      console.log(status);
      process.exit(1);
    }
    success('工作区干净');
  } catch {
    warn('无法检查 git 状态，继续执行');
  }

  // ---- Step 2: 运行测试 ----
  step(2, totalSteps, '运行测试');
  if (skipTests) {
    warn('跳过测试 (--skip-tests)');
  } else if (!dryRun) {
    try {
      info('运行 pnpm test ...');
      const result = run('pnpm test 2>&1 | tail -5');
      console.log(result);
      success('测试通过');
    } catch (e: any) {
      error('测试失败！');
      console.log(e.stdout || e.message);
      process.exit(1);
    }
  } else {
    info('DRY RUN: 跳过测试');
  }

  // ---- Step 3: 更新 package.json ----
  step(3, totalSteps, '更新 package.json');
  if (!dryRun) {
    currentPkg.version = newVersion;
    writePkg(currentPkg);
    success(`版本: ${currentVersion} → ${newVersion}`);
  } else {
    info(`DRY RUN: package.json ${currentVersion} → ${newVersion}`);
  }

  // ---- Step 4: 更新 VERSION_HISTORY ----
  step(4, totalSteps, '更新 VERSION_HISTORY');
  if (!dryRun) {
    let versionTs = readFileSync(VERSION_TS_PATH, 'utf-8');
    // 提取变更描述的关键词作为 highlights
    const highlights = message.split(/[,，、+]/).map(s => s.trim()).filter(Boolean).slice(0, 4);
    const newEntry = `  { version: '${newVersion}', date: '${today()}', highlights: [${highlights.map(h => `'${h}'`).join(', ')}] },`;

    // 在 VERSION_HISTORY 数组中插入新条目（在第一个条目之前）
    versionTs = versionTs.replace(
      /(export const VERSION_HISTORY[\s\S]*?\[)/,
      `$1\n${newEntry}`
    );
    writeFileSync(VERSION_TS_PATH, versionTs);
    success(`VERSION_HISTORY 已添加 ${newVersion}`);
  } else {
    info(`DRY RUN: VERSION_HISTORY 添加 ${newVersion}`);
  }

  // ---- Step 5: 更新 CHANGELOG.md ----
  step(5, totalSteps, '更新 CHANGELOG.md');
  if (!dryRun) {
    let changelog = readFileSync(CHANGELOG_PATH, 'utf-8');
    const tag = isPrerelease ? '🔧' : '🚀';
    const level = isPrerelease ? '###' : '##';
    const newEntry = `${level} [${newVersion}] - ${today()}\n\n### ${tag} 变更\n\n- ${message}\n\n`;

    // 在第一个 ## 之前插入
    changelog = changelog.replace(/^(## \[)/m, newEntry + '$1');
    writeFileSync(CHANGELOG_PATH, changelog);
    success('CHANGELOG.md 已更新');
  } else {
    info('DRY RUN: CHANGELOG.md 更新');
  }

  // ---- Step 6: 更新文档 ----
  step(6, totalSteps, '更新文档');
  if (skipDocs) {
    warn('跳过文档更新 (--skip-docs)');
  } else if (!dryRun) {
    // API.md
    if (existsSync(API_DOC_PATH)) {
      let apiDoc = readFileSync(API_DOC_PATH, 'utf-8');
      apiDoc = apiDoc.replace(
        /版本[：:]\s*v?[\d.]+(-[a-zA-Z0-9.]+)?/g,
        `版本：v${newVersion}`
      );
      apiDoc = apiDoc.replace(
        /\d{4}-\d{2}-\d{2}(?=\s*\n|\s*$)/g,
        today()
      );
      writeFileSync(API_DOC_PATH, apiDoc);
      success('docs/API.md 已更新');
    }
    // DEPLOYMENT.md
    if (existsSync(DEPLOY_DOC_PATH)) {
      let deployDoc = readFileSync(DEPLOY_DOC_PATH, 'utf-8');
      deployDoc = deployDoc.replace(
        /版本[：:]\s*v?[\d.]+(-[a-zA-Z0-9.]+)?/g,
        `版本：v${newVersion}`
      );
      deployDoc = deployDoc.replace(
        /\d{4}-\d{2}-\d{2}(?=\s*\n|\s*$)/g,
        today()
      );
      writeFileSync(DEPLOY_DOC_PATH, deployDoc);
      success('docs/DEPLOYMENT.md 已更新');
    }
  } else {
    info('DRY RUN: 跳过文档更新');
  }

  // ---- Step 7: Git 提交 + Tag ----
  step(7, totalSteps, 'Git 提交 + Tag');
  if (!dryRun) {
    run('git add -A');
    run(`git commit -m "release: v${newVersion} - ${message}"`);
    run(`git tag v${newVersion} -m "${message}"`);
    success(`提交: release: v${newVersion} - ${message}`);
    success(`标签: v${newVersion}`);
  } else {
    info(`DRY RUN: git commit + tag v${newVersion}`);
  }

  // ---- Step 8: 推送到 GitHub ----
  step(8, totalSteps, '推送到 GitHub');
  if (!shouldPush) {
    warn('未推送 (--push 未指定)');
    info('手动推送: git push origin main --tags');
  } else if (!dryRun) {
    try {
      run('git push origin main --tags');
      success('推送成功');
    } catch (e: any) {
      error('推送失败！');
      console.log(e.message);
      info('请检查 GitHub 认证后手动推送: git push origin main --tags');
    }
  } else {
    info('DRY RUN: 跳过推送');
  }

  // ---- Step 9: 创建 GitHub Release ----
  step(9, totalSteps, '创建 GitHub Release');
  if (!shouldPush || isPrerelease) {
    if (isPrerelease) {
      info('预发布版本，跳过 GitHub Release 创建');
    } else {
      info('未推送，跳过 GitHub Release 创建');
    }
  } else if (!dryRun) {
    try {
      const releaseNotes = `## v${newVersion}\n\n${message}\n\n### 自动生成\n- 发布时间: ${today()}\n- 发布类型: ${isPrerelease ? '预发布' : '正式'}\n- 测试: ${skipTests ? '跳过' : '通过'}`;
      const notesFile = resolve(ROOT, '.release-notes.tmp.md');
      writeFileSync(notesFile, releaseNotes);

      run(`gh release create v${newVersion} --title "v${newVersion}" --notes-file "${notesFile}"`);
      // 清理临时文件
      run(`rm -f "${notesFile}"`);
      success('GitHub Release 已创建');
    } catch (e: any) {
      warn('GitHub Release 创建失败 (gh CLI 可能未安装或未认证)');
      info('手动创建: gh release create v' + newVersion);
    }
  } else {
    info('DRY RUN: 跳过 GitHub Release');
  }

  // ---- 完成 ----
  log(`\n${colors.bold}${colors.green}🎉 发布完成！${colors.reset}\n`);
  log(`  版本:  ${colors.bold}v${newVersion}${colors.reset}`);
  log(`  类型:  ${isPrerelease ? '预发布' : '正式发布'}`);
  log(`  描述:  ${message}`);
  log(`  日期:  ${today()}`);
  if (shouldPush) {
    log(`  GitHub: https://github.com/arwei944/ai-task-hub/releases/tag/v${newVersion}`);
  }
  log(`\n  ${colors.cyan}下次发布提示:${colors.reset}`);
  log(`  npx tsx scripts/release.ts <version> --message "描述" --push`);
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
