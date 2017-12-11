const puppeteer = require('puppeteer')

module.exports = async (filein, fileout) => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.goto(`file:///${filein}`, {waitUntil: 'networkidle2'})
  await page.setViewport({ ...page.viewport(), width: 1280 })
  await page.screenshot({ path: fileout, fullPage: true })

  browser.close()
}
