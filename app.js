'use strict';
const { PDFDocument } = require('pdf-lib'); // imports
const fs = require('fs');
const multer = require('multer')
const upload = multer()
const open = require('open')
const base64 = require('base64topdf');
const express = require('express')
const { v4: uuidv4 } = require('uuid');
var bodyParser = require('body-parser')
const app = express()
const path = require('path')
var b64 = ""
var matchingKeyExists = false //flag


app.use(bodyParser.urlencoded({ extended: false }))  //setup
app.use(bodyParser.json())
app.use(bodyParser.raw())
app.use(bodyParser.text())
app.use(upload.any())
app.use(express.static('public'))

const port = 1337  //Host on port 1337

app.post("/", (req, res) => {
    const data = validateJSON(req.files[0].buffer.toString()) //Checks if the first file is JSON data or not
    if (data) {
        var jsonData = req.files[0].buffer.toString()  //If JSON is the first file
        jsonData = JSON.parse(jsonData)
        b64 = req.files[1].buffer.toString('base64')
    }
    else {
        var jsonData = req.files[1].buffer.toString() //If PDF is the first file
        jsonData = JSON.parse(jsonData)
        b64 = req.files[0].buffer.toString('base64')
    }

    run(b64, jsonData)  //fill in PDF using the data from the 2 files
        .then(PDF => {
            console.log(PDF)
            res.contentType("application/pdf")
            res.send(PDF)
            fs.unlinkSync('./asdhwbvjhsavd_filled.pdf')  //removes saved filled pdf
        })
})

app.get("/", (req, res) => {  //homepage path
    res.sendFile(path.join(__dirname + '/home.html'))
})

app.get("/upload", (req, res) => {  //upload files page path
    res.sendFile(path.join(__dirname + '/upload.html'))
})

app.get("/access", (req, res) => {  //access uploaded files page path
    res.sendFile(path.join(__dirname + '/access.html'))
})

app.post("/upload", (req, res) => {
    res.sendFile(path.join(__dirname + '/upload.html'))  //send PDF
    b64 = req.files[0].buffer.toString('base64') //encoding
    const bufferString = req.files[0].buffer.toString('utf8')
    const key = uuidv4().substring(0, 6)  //Unique ID
    const filename = req.files[0].originalname
    const filepath = path.join(__dirname + "\\" + filename)//Access file path
    try {  //Store IDs in a JSON
        const bufferData = fs.readFileSync('PDF_storage.json')
        const parseData = JSON.parse(bufferData)
        parseData[key] = filepath
        const newData = JSON.stringify(parseData)
        fs.writeFileSync('PDF_storage.json', newData)
    } catch (e) {  //error
        var test = JSON.stringify(new function () { this[key] = filepath; }, null, '\t')
        fs.appendFile('PDF_storage.json', test, err => {
            if (err) {
                throw err
            }
        })
    }
    console.log(`This PDF's key is ${key}! Don't forget it!`) //Tells user the key/unique ID
})

app.post("/access", (req, res) => {
    console.log("hi")
    const body = req.body
    console.log(body.PDFID)

    //res.send("POSTED")
})

function validateJSON(data) {
    try {
        var jsonData = JSON.parse(data)  //Checks if its JSON data
        return true
    }
    catch (e) {
        return false
    }
}
async function run(b64, jsonData) {
    let decodePdf = await base64.base64Decode(`${b64}`, 'asdhwbvjhsavd.pdf')  //decode base64 to PDF and saves it
    const pdf = await PDFDocument.load(fs.readFileSync('./asdhwbvjhsavd.pdf'));  //open decoded PDF
    const formPdf = pdf.getForm();  //get forms and fields PDF metadata
    const fields = formPdf.getFields();
    const key = Object.keys(jsonData)  //get keys from JSON
    fields.forEach(field => {  //for every field
        const type = field.constructor.name
        const name = field.getName()
        if (`${type}` == "PDFTextField") {  //fill in Text fields
            if (key.includes(`${name}`)) {
                field.setText(jsonData[name])
                matchingKeyExists = true

            }
        } else if (`${type}` == "PDFDropdown") {  //select from dropdown
            if (key.includes(`${name}`)) {
                field.select(jsonData[name])
                matchingKeyExists = true
            }
        } else if (`${type}` == "PDFCheckBox") {  //select checkboxes
            if (key.includes(`${name}`)) {
                if (jsonData[name] == 1) {
                    field.check()
                } else {
                    field.uncheck()
                }
                matchingKeyExists = true
            }
        } else if (`${type}` == "PDFRadioGroup") {  //select radio button (button with only 1 allowed E.X. test question with answers A, B, C, D)
            if (key.includes(`${name}`)) {
                field.select(jsonData[name])
                matchingKeyExists = true
            }
        }
    })
    if (matchingKeyExists == false) { //if never updated any fields a matching key doesn't exist
        console.log('No matching keys between JSON and PDF! Either PDF is not fillable or JSON and PDF are not properly formatted!')
    }
    matchingKeyExists = false //reset flag
    form_pdf.flatten();  //flattens the PDF (marks as Read-Only/Non-fillable/Filled/etc.)
    fs.writeFileSync('./asdhwbvjhsavd_filled.pdf', await pdf.save());  //save the pdf with a gibberish name to not overwrite any of the user's pdfs
    const filled_pdf = fs.readFileSync('./asdhwbvjhsavd_filled.pdf')
    fs.unlinkSync('./asdhwbvjhsavd.pdf')  //removes original unfilled pdf
    return await filled_pdf
}

app.listen(port, () => {
    open("http://localhost:1337")
    console.log(`listening on port ${port}`)  //message to show program is running
})
