#!/usr/bin/env node

const Bot = require('./bot')

module.exports = Run

function Run () {
  Bot.create()

  Bot.comment(`
    <h2>Bundle Cop 🚓</h2>
    <strong>${bot.artifactLink('bundle-cop/index.html', `Bundle size comparison for '${bot.env.commitMessage}'`)}</strong>
  `)
}
