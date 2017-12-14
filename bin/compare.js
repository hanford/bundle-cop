#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const chalk = require('chalk')
const _ = require('lodash')
const cwd = process.cwd()

module.exports = function (oldStats, newStats) {
  return new Promise((done, failed) => {
    let output = 'bundle-cop/'
    let oldPath = path.resolve(cwd, oldStats)
    let newPath = path.resolve(cwd, newStats)
    let outputPath = path.resolve(cwd, output)

    function checkPathExists(p) {
      if (!fs.existsSync(p)) {
        console.error(chalk.red(`Error: ${p} does not exist!`))
        failed()
      }
    }

    checkPathExists(oldPath)
    checkPathExists(newPath)

    function reducer (acc, value) {
      acc[value.name] = value.size
      return acc
    }

    oldAssets = require(oldPath).assets.reduce(reducer, {})
    newAssets = require(newPath).assets.reduce(reducer, {})

    function convert(o, n) {
      return {
        oldSize: o / 1024,
        newSize: n / 1024,
        diff: (n - o) / 1024,
        pdiff: (1 - (n / o)) * -100
      }
    }

    oldAssets = _.mapValues(oldAssets, (value) => { return { oldSize: value } })
    newAssets = _.mapValues(newAssets, (value) => { return { newSize: value } })

    _.merge(oldAssets, newAssets)

    oldAssets = _.mapValues(oldAssets, (value) => {
      return {
        oldSize: value.oldSize / 1024,
        newSize: value.newSize / 1024,
        diff: (value.newSize - value.oldSize) / 1024,
        pdiff: (1 - (value.newSize / value.oldSize)) * -100
      }
    })

    let bigger = {}
    let smaller = {}
    let noChange = {}
    let onlyInOld = {}
    let onlyInNew = {}

    _.forEach(oldAssets, (value, key) => {
      if (Math.abs(value.pdiff) < 1) {
        noChange[key] = value
        return
      }

      if (value.diff > 0) {
        bigger[key] = value
        return
      }

      if (value.diff < 0) {
        smaller[key] = value
        return
      }

      if (value.oldSize && !value.newSize) {
        onlyInOld[key] = value
        return
      }

      if (value.newSize && !value.oldSize) {
        onlyInNew[key] = value
        return
      }
    })

    function format (value) {
      return {
        oldSize: value.oldSize ? `${value.oldSize.toFixed(2)} KB` : '',
        newSize: value.newSize ? `${value.newSize.toFixed(2)} KB` : '',
        diff: value.diff ? `${value.diff.toFixed(2)} KB` : '',
        pdiff: value.pdiff ? `${value.pdiff.toFixed(2)}%` : ''
      }
    }

    bigger = _.mapValues(bigger, format)
    smaller = _.mapValues(smaller, format)
    noChange = _.mapValues(noChange, format)
    onlyInOld = _.mapValues(onlyInOld, format)
    onlyInNew = _.mapValues(onlyInNew, format)

    function convertToString (obj) {
      let st = ''

      _.forEach(obj, function (value, key) {
        let row = `
          <tr>
            <td>${key}</td>
            <td class='right'>${value.oldSize}</td>
            <td class='right'>${value.newSize}</td>
            <td class='right'>${value.diff}</td>
            <td class='right'>${value.pdiff}</td>
          </tr>
        `
        st += row
      })

      return st
    }

    if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath)

    const tmpl = _.template(html)

    const rows = {
      bigger: convertToString(bigger),
      smaller: convertToString(smaller),
      same: convertToString(noChange),
      onlyOld: convertToString(onlyInOld),
      onlyNew: convertToString(onlyInNew)
    }

    const compiled = tmpl(rows)

    fs.writeFileSync(path.resolve(outputPath, 'index.html'), compiled)

    done()
  })
}

const css = `
  body {
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    display: flex;
  }

  .container {
    margin: auto;
    flex: 1;
    overflow: auto;
    height: 100%;
  }

  .panel {
    text-align: center;
  }

  .panel-header {
    color: white;
    font-weight: bold;
    text-align: center;
    padding: 16px;
    position: sticky;
    top: 0;
  }

  .panel-body > table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 16px;
    border-bottom: 1px solid #ddd;
    border-right: 1px solid #ddd;
  }

  td.right {
    text-align: right;
  }

  .panel-header.bigger {
    background-color: rgba(225, 25, 25, 0.75);
  }

  .panel-header.smaller {
    background-color: rgba(25, 150, 25, 0.75);
  }

  .panel-header.same {
    background-color: rgba(25, 25, 150, 0.75);
  }

  .panel-header.removed {
    background-color: rgba(25, 25, 150, 0.75);
  }

  .panel-header.added {
    background-color: rgba(25, 25, 150, 0.75);
  }

  nav {
    width: 250px;
    border-right: 1px solid #ddd;
  }

  .title {
    padding: 16px;
    margin: 0;
  }

  .link-container {
    display: flex;
    flex-direction: column;
  }

  .nav-link {
    display: flex;
    width: 100%;
    padding: 8px 16px;
    cursor: pointer;
    border-bottom: 1px solid #ddd;
    text-decoration: none;
    color: black;
  }

  .nav-link:hover {
    background-color rgba(0,0,0,0.05);
  }

  * {
    box-sizing: border-box;
  }
`

const html = `
  <html>
    <head>
      <style>
        ${css}
      </style>
    </head>
    <body>
      <nav>
        <h1 class='title'>Bundle Cop</h1>
        <div class='link-container'>
          <a class='nav-link' href='#bigger'>Larger Bundless</a>
          <a class='nav-link' href='#smaller'>Smaller Bundles</a>
          <a class='nav-link' href='#onlyOld'>Removed Bundles</a>
          <a class='nav-link' href='#onlyNew'>Added Bundles</a>
          <a class='nav-link' href='#same'>Same size (1% threshold)</a>
        </div>
      </nav>
      <div class='container'>
        <div class='panel bigger'>
          <a id='bigger'><div class='panel-header bigger'>Larger Bundles</div></a>
          <div class='panel-body'>
            <table>
              <tr class='table-header'>
                <th>Asset</th>
                <th>Old</th>
                <th>New</th>
                <th>Diff</th>
                <th>% Diff</th>
              </tr>
              <%= bigger %>
            </table>
          </div>
        </div>
        <div class='panel smaller'>
          <a id='smaller'><div class='panel-header smaller'>Smaller Bundles</div></a>
          <div class='panel-body'>
            <table>
              <tr class='table-header'>
                <th>Asset</th>
                <th>Old</th>
                <th>New</th>
                <th>Diff</th>
                <th>% Diff</th>
              </tr>
              <%= smaller %>
            </table>
          </div>
        </div>
        <div class='panel removed'>
          <a id='onlyOld'><div class='panel-header removed'>Removed Bundles</div></a>
          <div class='panel-body'>
            <table>
              <tr class='table-header'>
                <th>Asset</th>
                <th>Old</th>
                <th>New</th>
                <th>Diff</th>
                <th>% Diff</th>
              </tr>
              <%= onlyOld %>
            </table>
          </div>
        </div>
        <div class='panel added'>
          <a id='onlyNew'><div class='panel-header added'>Added Bundles</div></a>
          <div class='panel-body'>
            <table>
              <tr class='table-header'>
                <th>Asset</th>
                <th>Old</th>
                <th>New</th>
                <th>Diff</th>
                <th>% Diff</th>
              </tr>
              <%= onlyNew %>
            </table>
          </div>
        </div>
        <div class='panel same'>
          <a id='same'><div class='panel-header same'>Same-Sized Bundles</div></a>
          <div class='panel-body'>
            <table>
              <tr class='table-header'>
                <th>Asset</th>
                <th>Old</th>
                <th>New</th>
                <th>Diff</th>
                <th>% Diff</th>
              </tr>
              <%= same %>
            </table>
          </div>
        </div>
      </div>
    </body>
  </html>
`
