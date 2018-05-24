const helpers = require('./helpers.js')

const express = require('express')
const app = express()
const SECRET = process.env.SECRET || ''

app.post('/pug', helpers.parseJson, (req, res) => {
    res.header('content-type', 'application/json')
    helpers.tmpPugFile(req.body.pug).then(token => {
        res.write(JSON.stringify({
            status: true,
            token: token,
        }))
        res.end()
    }).catch(err => {
        helpers.sendSlack(err.toString())
        res.write(JSON.stringify({
            status: false,
            token: null,
        }))
        res.end()
    })
})

app.get('/pug', (req, res) => {
    helpers.masterDocumentToPDF(req.query.token).then(buffer => {
        res.header('Content-Disposition', 'filename='+req.query.token+'.pdf')
        res.header('Content-Type', 'application/pdf')
        res.send(buffer)
    }).catch(err => {
        helpers.sendSlack(err.toString())
        res.write('Error!')
        res.end()
    })
})

app.get('*', (req, res) => {
    res.write('404 Page Not Found!')
    res.end()
})

app.listen(3300, () => console.log('App listening ...'))