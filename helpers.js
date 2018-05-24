const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')
const mjpage = require('mathjax-node-page')
const cheerio = require('cheerio')
const util = require('util')
const pug = require('pug')
const writeFile = util.promisify(fs.writeFile)
const crypto = require('crypto')
const request = require('request')
const bodyParser = require('body-parser')
const md5 = require('md5')

function getMatch (string, query) {
    let result = string.match(query)
    if (result) {
        result = result[1]
    }
    return result
}

function asyncMathjax (html) {
    return new Promise(resolve => {
            mjpage.mjpage(html, {
            format: ['TeX']
        }, {
            mml: true,
            css: true,
            html: true
        }, response => resolve(response))
    })
}

const puppeteerConfig = {
    headless: true,
    args: []
}

exports.tmpPugFile = (pubCode) => {
    return new Promise(async (resolve, reject) => {
        let filename = md5(pubCode)
        let path = './.tmp/'+filename+'.pug'
        let files = fs.readdirSync('./.tmp/')
        files.forEach(file => {
            if (file.match(/^.*\.pug$/) && file !== filename+'.pug') {
                fs.unlink('./.tmp/' + file, err => {})
            }
        })
        if (fs.existsSync(path)) {
            resolve(filename)
            return
        }
        await fs.writeFile(path, pubCode, (err) => {
            if (err) {
                reject(err)
            }
        })
        resolve(filename)
    })
}

exports.getTmpPug = (filename) => {
    return new Promise(async resolve => {
        let path = './.tmp/'+filename+'.pug'
        if (fs.existsSync(path)) {
            let pugCode = fs.readFileSync(path)
            resolve(pugCode)
            return
        }
        resolve('')
    })
}

exports.parseJson = bodyParser.json()

exports.sendSlack = (message) => {
    console.log(message)
    return
    request({
        method: 'post',
        url: 'https://hooks.slack.com/services/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',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            "icon_emoji": ':disappointed_relieved:',
            "username": 'EZWeb',
            'text': message,
            "channel": '#contract-error',
        })
    })
}

exports.checkSignature = (value, sign, secret) => {
    const hmac = crypto.createHmac('md5', secret)
    return sign == hmac.update(value.toString()).digest('hex')
}

exports.masterDocumentToPDF = (filename) => {
    return new Promise(async (resolve, reject) => {
        const browser = await puppeteer.launch(puppeteerConfig)
        const page = await browser.newPage()
        page.on('pageerror', (err) => {
            reject(err)
            return
        }).on('error', (err) => {
            reject(err)
            return
        })
        let inputPath = path.resolve('./.tmp/'+filename+'.pug')
        let html
        try {
            html = pug.renderFile(inputPath, {
                basedir: path.resolve('./')
            })
        } catch (err) {
            reject(err)
            return
        }
        html = await asyncMathjax(html)
        let parsedHtml = cheerio.load(html)
        html = parsedHtml.html()
        let headerTemplate = parsedHtml('template.header').html()
        let footerTemplate = parsedHtml('template.footer').html()
        const tempHTML = path.resolve('./.tmp/index_tmp.htm')
        await writeFile(tempHTML, html)
        await page.goto('file:' + tempHTML, {waitUntil: 'networkidle2'})
        setTimeout(async () => {
            let options = {
                displayHeaderFooter: headerTemplate || footerTemplate,
                headerTemplate,
                footerTemplate,
                printBackground: true
            }
            let width = getMatch(html, /-relaxed-page-width: (\S+);/m)
            if (width) {
                options.width = width
            }
            let height = getMatch(html, /-relaxed-page-height: (\S+);/m)
            if (height) {
                options.height = height
            }
            let size = getMatch(html, /-relaxed-page-size: (\S+);/m)
            if (size) {
                options.size = size
            }
            resolve(await page.pdf(options))
        }, 3000)
    })
}