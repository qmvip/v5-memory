#!/usr/bin/env node

/**
 * V5 Memory - NPM Publish Script
 * 
 * Usage: node scripts/publish.js [version]
 * 
 * Examples:
 *   node scripts/publish.js         # Patch version (0.0.1 -> 0.0.2)
 *   node scripts/publish.js minor   # Minor version (0.0.1 -> 0.1.0)
 *   node scripts/publish.js major   # Major version (0.0.1 -> 1.0.0)
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Colors
const green = '\x1b[32m'
const red = '\x1b[31m'
const yellow = '\x1b[33m'
const reset = '\x1b[0m'

function log(msg, color = reset) {
  console.log(`${color}${msg}${reset}`)
}

function run(cmd, options = {}) {
  log(`> ${cmd}`, yellow)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: rootDir, ...options })
    return true
  } catch (e) {
    log(`Error: ${e.message}`, red)
    return false
  }
}

function getVersion() {
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'))
  return pkg.version
}

function bumpVersion(currentVersion, type = 'patch') {
  const [major, minor, patch] = currentVersion.split('.').map(Number)
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`
  }
}

async function publish() {
  const args = process.argv.slice(2)
  const versionType = args[0] || 'patch'
  
  log('\n=== V5 Memory NPM Publish ===\n', green)
  
  // Step 1: Check git status
  log('\n[1/6] Checking git status...', green)
  const gitStatus = execSync('git status --porcelain', { cwd: rootDir }).toString().trim()
  if (gitStatus) {
    log('Warning: Uncommitted changes:', yellow)
    log(gitStatus)
    const proceed = args.includes('--force') || args.includes('-f')
    if (!proceed) {
      log('Use --force to proceed anyway', yellow)
      return
    }
  }
  
  // Step 2: Get current version
  const currentVersion = getVersion()
  log(`\n[2/6] Current version: ${currentVersion}`, green)
  
  // Step 3: Bump version
  const newVersion = bumpVersion(currentVersion, versionType)
  log(`New version: ${newVersion}`, green)
  
  // Update package.json
  const pkgPath = join(rootDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  pkg.version = newVersion
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  log(`Updated package.json`, green)
  
  // Step 4: Build
  log(`\n[3/6] Building...`, green)
  
  // Build web
  if (!run('npm run build:web')) {
    log('Web build failed', red)
    return
  }
  
  // Step 5: Git commit and tag
  log(`\n[4/6] Git commit and tag...`, green)
  run(`git add -A`)
  run(`git commit -m "Release v${newVersion}"`)
  run(`git tag v${newVersion}`)
  
  // Step 6: Publish to npm
  log(`\n[5/6] Publishing to npm...`, green)
  run('npm publish --access public')
  
  // Push to remote
  log(`\n[6/6] Pushing to remote...`, green)
  run('git push')
  run('git push --tags')
  
  log(`\n=== Published v${newVersion} ===`, green)
  log(`\nNPM: https://www.npmjs.com/package/@wangyi/v5-memory`, green)
  log(`GitHub: https://github.com/wangyi/v5-memory/releases/tag/v${newVersion}\n`, green)
}

publish().catch(console.error)
