const { basename } = require('path')
const { execSync } = require('child_process')

const ENV = {
  artifacts: 'CIRCLE_ARTIFACTS',
  auth: 'GH_AUTH_TOKEN',
  buildNum: 'CIRCLE_BUILD_NUM',
  buildUrl: 'CIRCLE_BUILD_URL',
  home: 'HOME',
  pr: 'CI_PULL_REQUEST',
  repo: 'CIRCLE_PROJECT_REPONAME',
  sha1: 'CIRCLE_SHA1',
  username: 'CIRCLE_PROJECT_USERNAME'
}

const exec = (command, options) => execSync(command, options).toString('utf8').trim()

const curl = (url, data) => exec(`curl --silent --data @- ${url}`, {input: data})

module.exports = class Bot {
  static create (options = {}) {
    const missing = []

    for (let key in ENV) {
      const name = ENV[key]
      if ((process.env[name] == null)) { missing.push(name) }
      ENV[key] = process.env[name]
    }

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables:\n\n${missing.join('\n')}\n`)
    }

    ENV.commitMessage = exec('git --no-pager log --pretty=format:"%s" -1').replace(/\\"/g, '\\\\"')
    ENV.prNumber = basename(ENV.pr)
    ENV.githubDomain = options.githubDomain != null ? options.githubDomain : 'api.github.com'

    return new Bot(ENV)
  }

  constructor (env) {
    this.env = env
  }

  artifactUrl (artifactPath) {
    return `${this.env.buildUrl}/artifacts/0/${this.env.home}/${this.env.repo}/${artifactPath}`
  }

  artifactLink (artifactPath, text) {
    return `<a href='${this.artifactUrl(artifactPath)}' target='_blank'>${text}</a>`
  }

  githubUrl (path) {
    return `https://${this.env.auth}:x-oauth-basic@${this.env.githubDomain}/${path}`
  }

  githubRepoUrl (path) {
    return this.githubUrl(`repos/${this.env.username}/${this.env.repo}/${path}`)
  }

  commentIssue (number, body) {
    return curl(this.githubRepoUrl(`issues/${number}/comments`), JSON.stringify({body}))
  }

  commentCommit (sha1, body) {
    return curl(this.githubRepoUrl(`commits/${sha1}/comments`), JSON.stringify({body}))
  }

  comment (body) {
    if ((this.env.prNumber) !== '') {
      return this.commentIssue(this.env.prNumber, body)
    } else {
      return this.commentCommit(this.env.sha1, body)
    }
  }
}
