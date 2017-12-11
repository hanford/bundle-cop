#!/usr/bin/env node

const cp = require('child_process')
const { resolve } = require('path')
const path = require('path')
const UUID = require('uuid')
const branchName = require('branch-name')
const chalk = require('chalk')
const fs = require('mz/fs')
const SimpleGit = require('simple-git')

const screenshot = require('./screenshot')

const log = console.log
const cwd = process.cwd()

module.exports = (async () => {
  const id = UUID.v4()
  log('creating tmp')

  try {
    await fs.mkdir(`${cwd}/tmp`)
  } catch (e) {
  }

  log('running npm install')
  await exec(`npm install`)
  log(`running build-analyze`)
  await exec(`npm run build-analyze`)

  const branchStats = await fs.readFile(`${cwd}/.next/stats.json`, 'utf8')
  const branchStatsPath = path.resolve(cwd, 'tmp', 'branch-stats.json')

  log(`writing branch-stats.json to ${branchStatsPath}`)
  await fs.writeFile(branchStatsPath, branchStats, 'utf8')

  const git = SimpleGit(cwd)
  const prevBranch = await branchName.get()

  log(`git checking out 'next' branch from ${prevBranch}`)
  git.stash()

  git.checkout('next', async (err, data) => {
    log(`rm -rf node_modules`)
    await exec('rm -rf node_modules')

    log(`npm install`)
    await exec('npm install')

    log(`running build-analyze on master`)
    await exec(`npm run build-analyze`)

    const masterStats = await fs.readFile(`${cwd}/.next/stats.json`, 'utf8')
    const masterStatsPath = path.resolve(cwd, 'tmp', 'master-stats.json')

    log(`writing master-stats.json to ${masterStatsPath}`)
    await fs.writeFile(masterStatsPath, masterStats, 'utf8')

    log(`installing webpack-compare-pretty`)
    await exec('npm i webpack-compare-pretty -g')

    log(`comparing`)
    await exec(`webpack-compare ${branchStatsPath} ${masterStatsPath} -o ${cwd}/tmp`)

    log(`openning headless chrome and taking screenshot`)
    await screenshot(`${cwd}/tmp/index.html`, `${cwd}/tmp/diff-${id}.png`)

    log(`deleting ${branchStatsPath} ${masterStatsPath}`)
    await exec(`rm -rf ${branchStatsPath} ${masterStatsPath}`)

    log(`deploying bundle..`)
    const deploy = await exec(`now tmp`)

    log('Checking out previous branch')

    git.checkout(prevBranch, async (err, data) => {
      log('Restoring git history')
      git.stash('pop')

      log('removing temp files')
      await exec(`rm -rf tmp`)

      log(chalk.green(deploy.stdout))
    })
  })
})()

function exec (command, options = {}) {
  return new Promise((done, failed) => {
    cp.exec(command, { cwd, ...options}, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout
        error.stderr = stderr
        failed(error)
        return
      }

      done({ stdout, stderr })
    })
  })
}
