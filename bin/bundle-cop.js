#!/usr/bin/env node

const path = require('path')
const branchName = require('branch-name')
const chalk = require('chalk')
const fs = require('mz/fs')
const SimpleGit = require('simple-git')
const assert = require('assert')
const { argv } = require('optimist')
const { branch, circleci, link } = argv
const github = require('ci-github')
const exec = require('await-exec')

const compare = require('./compare')

const execOpts = { log: true }
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

  await exec(`npm install`, execOpts)

  await exec(`npm run build-analyze`, execOpts)

  const branchStats = await fs.readFile(`${cwd}/.next/stats.json`, 'utf8')
  const branchStatsPath = path.resolve(cwd, 'bundle-cop', 'branch-stats.json')

  log(`writing branch-stats.json to ${branchStatsPath}`)
  await fs.writeFile(branchStatsPath, branchStats, 'utf8')

  log(`git checking out ${branch} branch from ${initBranch}`)
  git.stash()

  git.checkout(branch, async (err, data) => {
    if (err) return error(err)
    log(`checked out ${branch}`)

    await exec('npm install', execOpts)

    await exec(`npm run build-analyze`, execOpts)

    const masterStats = await fs.readFile(`${cwd}/.next/stats.json`, 'utf8')
    const masterStatsPath = path.resolve(cwd, 'bundle-cop', 'master-stats.json')

    log(`writing master-stats.json to ${masterStatsPath}`)
    await fs.writeFile(masterStatsPath, masterStats, 'utf8')

    log('running comparison')
    await compare(masterStatsPath, branchStatsPath)

    // await exec(`rm -rf ${branchStatsPath} ${masterStatsPath}`, execOpts)

    log(`stashing any potential changes on ${branch} (*.lock)`)
    git.stash()

    log(`Checking out ${initBranch}`)

    git.checkout(initBranch, async (err, data) => {
      if (err) return error(err)

      await exec('npm install', execOpts)

      if (circleci) {
        const Github = github.create()

        log('Running github comment scripts')

        const commit = `<div>Commit: <strong>${Github.env.commitMessage}</strong></div>`
        const hasLink = link ? `<div>Environment: <a href='${link}' target='_blank'>${link}</a></div>` : ''

        Github.comment(`<h2>Bundle Cop 🚓</h2>${commit} ${hasLink}<div>${Github.artifactLink('bundle-cop/index.html', 'Bundle size comparison')}</div>`)
      }
    })
  })
})()
