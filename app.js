'use strict';
const { PDFDocument } = require('pdf-lib'); // imports
const fs = require('fs');
const multer = require('multer')
const open = require('open')
const upload = multer()
const base64 = require('base64topdf');
const express = require('express')
const { v4: uuidv4, validate } = require('uuid');
var bodyParser = require('body-parser')
const app = express()
const path = require('path');
const { MongoClient } = require('mongodb');
var b64 = ""
const mongoose = require('mongoose')
//const GridFsStorage = require('multer-storage-gridfs')


app.use(bodyParser.urlencoded({ extended: false }))  //setup
app.use(bodyParser.json())
app.use(bodyParser.raw())
app.use(bodyParser.text())
app.use(upload.any())
app.use(express.static('public'))

const port = 1337  //Host on port 1337

app.post("/", (req, res) => {
    var stop = 0 //If this variable equals 1 it means that either the JSON or PDF file is empty

    if (validateJSON(req.files[0].buffer.toString())) {
        var jsonData = req.files[0].buffer.toString()  //If JSON is the first file
        jsonData = JSON.parse(jsonData)
        b64 = req.files[1].buffer.toString('base64')
    }
    else if (validateJSON(req.files[1].buffer.toString())) {
        var jsonData = req.files[1].buffer.toString() //If PDF is the first file
        jsonData = JSON.parse(jsonData)
        b64 = req.files[0].buffer.toString('base64')
    }

    else { //If the JSON file is not provided
        console.log("The JSON file is empty or not provided")
        res.send("The JSON file is empty or not provided")
        stop = 1
        res.end()
    }

    if (b64.length == 0 && stop == 0) { //If the PDF file is empty
        console.log("The PDF file is empty")
        res.send("The PDF file is empty")
        stop = 1
        res.end()
    }

    if (stop == 0) {
        run(b64, jsonData)  //fill in PDF using the data from the 2 files
            .then(PDF => {
                console.log(PDF)
                res.contentType("application/pdf")
                res.send(PDF)
                fs.unlinkSync('./asdhwbvjhsavd_filled.pdf')  //removes saved filled pdf
            })
    }
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

app.get("/retrieve", (req, res) => { //retrieve the keys of uploaded pdfs
    res.sendFile(__dirname + '/retrieve.html')
})

app.get("/register", (req, res) => { //retrieve the keys of uploaded pdfs
    res.sendFile(__dirname + '/register.html')
})

app.post("/upload", (req, res) => {
    res.sendFile(path.join(__dirname + '/upload.html'))  //send PDF
    const key = uuidv4().substring(0, 6)  //Unique ID
    const filename = req.files[0].originalname

    if (req.files[0].size == 0) {
        console.log("This PDF file is empty")
    }
    else {
        fs.writeFileSync('./' + filename, req.files[0].buffer)
        const filepath = path.join(__dirname + "\\" + filename)//Access file path
        try {  //Store IDs in a JSON
            const bufferData = fs.readFileSync('PDF_storage.json')
            const parseData = JSON.parse(bufferData)
            parseData[key] = filepath
            const newData = JSON.stringify(parseData)
            fs.writeFileSync('PDF_storage.json', newData)
        } catch (e) {  //error
            var newJson = JSON.stringify(new function () { this[key] = filepath; }, null, '\t')
            fs.appendFile('PDF_storage.json', newJson, err => {
                if (err) {
                    throw err
                }
            })
        }
        console.log(`This PDF's key is ${key}! Don't forget it!`) //Tells user the key/unique ID
        databaseSendRpdf(filename, key, req.files[0].buffer) //Send to mongoDB
    }
})

app.post("/access", (req, res) => {
    var data = databaseRetrieveRpdf(req.body.PDFID)
    const verify = validateJSON(req.files[0].buffer.toString())

    //This needs to be modified to work with the pdf data retrieved from mongodb (work in progess)
    if (verify) {
        const sentJson = JSON.parse(req.files[0].buffer.toString())
        const storageFile = fs.readFileSync('PDF_storage.json')
        const parsedFile = JSON.parse(storageFile)
        const jsonKeys = Object.keys(parsedFile)
        if (jsonKeys.includes(pdfID)) { // (req.body.PDFID) maybe
            encodePDF(parsedFile[pdfID], sentJson) // unsure what to put here
                .then(PDF => {
                    console.log(PDF)
                    res.contentType("application/pdf")
                    res.send(PDF)
                    fs.unlinkSync('./asdhwbvjhsavd_filled.pdf')
                })
        }
    }
    else {
        console.log("The JSON file submitted is empty")
        res.sendFile(path.join(__dirname + '/access.html'))
    }
    //res.sendFile(path.join(__dirname + '/access.html'))
})

app.post("/retrieve", (req, res) => {
    const checkFile = req.files[0].originalname
    const filePath = path.join(__dirname + "\\" + checkFile)
    try {
        const bufferJson = fs.readFileSync('PDF_storage.json')
        const parseData = JSON.parse(bufferData)
    }
    catch (e) {
        console.log("There is no JSON storing your PDFs! Go to the upload page to upload PDFs to the JSON!")
    }
})

app.post("/register", (req, res) => {
    res.sendFile(path.join(__dirname + '/register.html'))
    const userID = uuidv4().substring(0,5)
    const fName = req.body.fName
    const lName = req.body.lName
    const email = req.body.email
    databaseSendUser(fName, lName, email, userID)
    console.log(`Your userID is ${userID}! Make sure to write it down!`)
})

async function databaseSendUser(fName, lName, email, userID) {
    const uri = "mongodb+srv://pdfteam:QSTMiCd0lfLNx96q@pdfstorage.1qevxtf.mongodb.net/test"
    const client = new MongoClient(uri)

    try {
        await client.connect()
        const collection = client.db('Autofiller_Database').collection('User')
        const newData = {First_name: fName, Last_name: lName, email: email, userID: userID}
        await collection.insertOne(newData)
        //await createListing(clinet.db.collection('User'), { First_name: fName, Last_name: lName, email: email, userID: userID })
        findUID()
    } catch (e) {
        console.log(e)
        return
    }

    finally {
        await client.close()
    }
    return
}

async function databaseRetrieveRpdf(pdfKey) {
    //Gets the data from the matching pdfID
    const uri = "mongodb+srv://pdfteam:QSTMiCd0lfLNx96q@pdfstorage.1qevxtf.mongodb.net/test"
    const client = new MongoClient(uri)
    const pdfID = pdfKey

    try {
        await client.connect()
        console.log(pdfID)
        const result = await client.db("Autofiller_Database").collection("Raw_PDF")

        const query = { ID: pdfID }
        await result.findOne(query)
        console.log(result)
        await client.close()
    } catch (e) {
        throw err
    }
    return result
}

async function databaseSendRpdf(pdf, pdfKey, buffer) {
    const uri = "mongodb+srv://pdfteam:QSTMiCd0lfLNx96q@pdfstorage.1qevxtf.mongodb.net/test"
    const client = new MongoClient(uri)

    try {
        await client.connect()
        await createListing(client, { Id: pdfKey, Filename: pdf, Contents: buffer })
    } catch (e) {
        console.log(e)
        return
    }

    finally {
        await client.close()
    }
    return
}

async function createListing(client, newListing) {
    const result = await client.db("Autofiller_Database").collection("Raw_PDF").insertOne(newListing)

    console.log(`New listing created with the following id: ${result.insertedId}`)
}

async function listDatabases(client) {
    var databasesList = await client.db().admin().listDatabases()
    console.log("Databases:")

    databasesList.databases.forEach(db => console.log(` - ${db.name}`))
}

async function encodePDF(pdfPath, jsonData) {
    let encodedPDF = await base64.base64Encode(`${pdfPath}`)
    let test = await run(encodedPDF, jsonData)
    return test
}

async function findUID() {
    const uri = "mongodb+srv://pdfteam:QSTMiCd0lfLNx96q@pdfstorage.1qevxtf.mongodb.net/test"
    const client = new MongoClient(uri)
    try {
        const database = client.db("Autofiller_Database")
        const uid = database.collection("User")

        const query = { userID: "03fd8" }
        const id = await uid.findOne(query)
        if (id != null) {
            return false
        } else {
            console.log(id)
            return true
        }
    } catch (e) {
        console.log(e)
        return
    } finally {
        await client.close()
    }
}

function validateJSON(data) {
    try {
        var jsonData = JSON.parse(data)  //Checks if its JSON data
        return true
    }
    catch (e) {
        return false
    }
}

function verify(fields, key, b64) {
    var valid = 0
    if (key.length == 0) {
        console.log("Your json file has no values in it")
        valid = 1
    }

    if (fields.length == 0) {
        console.log("Your PDF file is not fillable")
        valid = 1
    }

    if (b64.length == 0) {
        console.log("Your PDF file is empty")
        valid = 1
    }

    return valid
}

async function run(b64, jsonData) {
    let decodePdf = await base64.base64Decode(`${b64}`, 'asdhwbvjhsavd.pdf')  //decode base64 to PDF and saves it
    const pdf = await PDFDocument.load(fs.readFileSync('./asdhwbvjhsavd.pdf'))  //open decoded PDF
    const formPdf = pdf.getForm();  //get forms and fields PDF metadata
    const fields = formPdf.getFields();
    const key = Object.keys(jsonData)  //get keys from JSON
    const valid = verify(fields, key, b64)
    var matches = 0

    if (valid == 0) {
        fields.forEach(field => {  //for every field
            const type = field.constructor.name
            const name = field.getName()
            if (`${type}` == "PDFTextField") {  //fill in Text fields
                if (key.includes(`${name}`)) {
                    matches += 1
                    field.setText(jsonData[name])
                }
            } else if (`${type}` == "PDFDropdown") {  //select from dropdown
                if (key.includes(`${name}`)) {
                    matches += 1
                    field.select(jsonData[name])
                }
            } else if (`${type}` == "PDFCheckBox") {  //select checkboxes
                if (key.includes(`${name}`)) {
                    matches += 1
                    if (jsonData[name] == 1) {
                        field.check()
                    } else {
                        field.uncheck()
                    }
                }
            } else if (`${type}` == "PDFRadioGroup") {  //select radio button (button with only 1 allowed E.X. test question with answers A, B, C, D)
                if (key.includes(`${name}`)) {
                    matches += 1
                    field.select(jsonData[name])
                }
            }
        })
    }
    console.log("You your json and PDF have", matches, "matching fields")
    formPdf.flatten();  //flattens the PDF (marks as Read-Only/Non-fillable/Filled/etc.)
    fs.writeFileSync('./asdhwbvjhsavd_filled.pdf', await pdf.save());  //save the pdf with a gibberish name to not overwrite any of the user's pdfs
    const filled_pdf = fs.readFileSync('./asdhwbvjhsavd_filled.pdf')
    fs.unlinkSync('./asdhwbvjhsavd.pdf')  //removes original unfilled pdf
    let encodedPDF = await base64.base64Encode('./asdhwbvjhsavd_filled.pdf')  //encode into base64
    console.log(typeof encodedPDF)
    return await filled_pdf
}

app.listen(port, () => {
    open("http://localhost:1337")
    console.log(`listening on port ${port}`)  //message to show program is running
})
