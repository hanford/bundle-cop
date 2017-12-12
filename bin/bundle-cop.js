#!/usr/bin/env node

const cp = require('child_process')
const { resolve } = require('path')
const path = require('path')
const UUID = require('uuid')
const branchName = require('branch-name')
const chalk = require('chalk')
const fs = require('mz/fs')
const SimpleGit = require('simple-git')
const assert = require('assert')
const { argv } = require('optimist')

const cwd = process.cwd()
const log = console.log
let initBranch = null

const { branch } = argv

assert(branch, 'Please pass in branch using the --branch flag')

branchName.get().then(name => initBranch = name)

module.exports = (async () => {
  const id = UUID.v4()

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

  const git = SimpleGit(cwd)

  log(`git checking out ${branch} branch from ${initBranch}`)
  git.stash()

  git.checkout(branch, async (err, data) => {
    await exec('npm install')

    await exec(`npm run build-analyze`)

    const masterStats = await fs.readFile(`${cwd}/.next/stats.json`, 'utf8')
    const masterStatsPath = path.resolve(cwd, 'bundle-cop', 'master-stats.json')

    log(`writing master-stats.json to ${masterStatsPath}`)
    await fs.writeFile(masterStatsPath, masterStats, 'utf8')

    await exec('npm i webpack-compare-pretty -g')

    await exec(`webpack-compare ${branchStatsPath} ${masterStatsPath} -o ${cwd}/bundle-cop`)

    await exec(`rm -rf ${branchStatsPath} ${masterStatsPath}`)

    const deploy = await exec(`now bundle-cop`)

    log('Checking out previous branch')

    git.checkout(initBranch, async (err, data) => {
      await exec(`rm -rf bundle-cop`)
      await exec('npm install')

      log(chalk.green(deploy.stdout))
    })
  })
})()

function exec (command, options = {}) {
  log(command)

  return new Promise((done, failed) => {
    cp.exec(command, { cwd, ...options }, (error, stdout, stderr) => {
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
