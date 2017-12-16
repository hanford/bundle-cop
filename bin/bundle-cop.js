#!/usr/bin/env node

const cp = require('child_process')
const path = require('path')
const branchName = require('branch-name')
const chalk = require('chalk')
const fs = require('mz/fs')
const SimpleGit = require('simple-git')
const assert = require('assert')
const { argv } = require('optimist')
const { branch, team, token } = argv

const compare = require('./compare')
const Bot = require('./create-bot')

const cwd = process.cwd()
const git = SimpleGit(cwd)
const { log, error } = console

assert(branch, `--branch must be defined`)

let initBranch = null

branchName.get().then(name => {
  initBranch = name
})

module.exports = (async () => {
  try {
    await fs.mkdir(`${cwd}/bundle-cop`)
    log('created bundle-cop directory')
  } catch (e) {
  }

  await exec(`npm install`)

  await exec(`npm run build-analyze`)

  const branchStats = await fs.readFile(`${cwd}/.next/stats.json`, 'utf8')
  const branchStatsPath = path.resolve(cwd, 'bundle-cop', 'branch-stats.json')

  log(`writing branch-stats.json to ${branchStatsPath}`)
  await fs.writeFile(branchStatsPath, branchStats, 'utf8')

  log(`git checking out ${branch} branch from ${initBranch}`)
  git.stash()

  git.checkout(branch, async (err, data) => {
    if (err) return error(err)
    log(`checked out ${branch}`)

    await exec('npm install')

    await exec(`npm run build-analyze`)

    const masterStats = await fs.readFile(`${cwd}/.next/stats.json`, 'utf8')
    const masterStatsPath = path.resolve(cwd, 'bundle-cop', 'master-stats.json')

    log(`writing master-stats.json to ${masterStatsPath}`)
    await fs.writeFile(masterStatsPath, masterStats, 'utf8')

    log('running comparison')
    await compare(masterStatsPath, branchStatsPath)

    await exec(`rm -rf ${branchStatsPath} ${masterStatsPath}`)

    log(`stashing any potential changes on ${branch} (*.lock)`)
    git.stash()

    log(`Checking out ${initBranch}`)

    git.checkout(initBranch, async (err, data) => {
      if (err) return error(err)

      await exec('npm install')

      Bot()
    })
  })
})()

function exec (command, options = { log: true }) {
  if (options.log) {
    log(command)
  }

  return new Promise((done, failed) => {
    cp.exec(command, { cwd, ...options }, (err, stdout, stderr) => {
      if (err) {
        error(err)
        err.stdout = stdout
        err.stderr = stderr
        failed(err)
        return
      }

      done({ stdout, stderr })
    })
  })
}
