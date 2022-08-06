const express = require("express");
const bodyParser = require("body-parser");
const {MongoMemoryServer} = require("mongodb-memory-server");
const {MongoClient} = require("mongodb");
//const PgMem = require("pg-mem");
const { Pool, Client } = require("pg");

//const db = PgMem.newDb();
let db = null;

const fs = require('fs');

let database = null;
const collectionName = "measurements";

async function startDatabase() {
    //const mongod = await MongoMemoryServer.create();
    //const uri = mongod.getUri();	
    const uri = "mongodb://root:rw,.12a@127.0.0.1:27017/"
    const connection = await MongoClient.connect(uri, {useNewUrlParser: true});
    database = connection.db();

    console.log("Mongo client database Up");

    try {
        const client = new Client({
            user: "postgres",
            host: "127.0.0.1",
            database: "postgres",
            password: "rw,.12a",
            port: 5432
        })
 
        await client.connect()
        
        db = client

        console.log("Postgres client database Up");
    } catch (error) {
        console.log(error)
    }
}

async function getDatabase() {
    if (!database) await startDatabase();
    return database;
}

async function insertMeasurement(message) {
    const {insertedId} = await database.collection(collectionName).insertOne(message);
    return insertedId;
}

async function getMeasurements() {
    return await database.collection(collectionName).find({}).toArray();	
}

const app = express();

app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json())

app.use(express.static('spa'));
app.use('/js', express.static('spa'));

const PORT = 8080;

app.post('/measurement', function (req, res) {       
    
    //console.log(req)
    console.log("device id    : " + req.body.id + " key         : " + req.body.key + " temperature : " + req.body.t + " humidity  : " + req.body.h + " Pressure : " +  req.body.p);	
    const {insertedId} = insertMeasurement({id:req.body.id, t:req.body.t, h:req.body.h, p: req.body.p});
	res.send("received measurement into " +  insertedId);
});


app.post('/measurement/json', function (req, res) {       
    
    //console.log(req.body)
    console.log("device id    : " + req.body.id + " key         : " + req.body.key + " temperature : " + req.body.t + " humidity  : " + req.body.h + " Pressure : " +  req.body.p);	
    const {insertedId} = insertMeasurement({id:req.body.id, t:req.body.t, h:req.body.h, p: req.body.p});
	res.send("received measurement into " +  insertedId);
});

app.post('/device', async (req, res) => {
	console.log("device id    : " + req.body.id + " name        : " + req.body.n + " key         : " + req.body.k );

    await db.query("INSERT INTO devices VALUES ('"+req.body.id+ "', '"+req.body.n+"', '"+req.body.k+"')");
	res.send("received new device");
});


app.get('/web/device', async (req, res) => {

    var devices = await db.query("SELECT * FROM devices");

	var result = devices.rows.map( function(device) {
		console.log(device);
		return '<tr><td><a href=/web/device/'+ device.device_id +'>' + device.device_id + "</a>" +
			       "</td><td>"+ device.name+"</td><td>"+ device.key+"</td></tr>";
	   }
	);
	res.send("<html>"+
		     "<head><title>Sensores</title></head>" +
		     "<body>" +
		        "<table border=\"1\">" +
		           "<tr><th>id</th><th>name</th><th>key</th></tr>" +
		           result +
		        "</table>" +
		     "</body>" +
		"</html>");
});

/*
 * Canibalized from
 *    https://www.npmjs.com/package/sprightly
 *    https://github.com/obadakhalili/Sprightly/blob/main/index.js
 */
function render(template, vars) {
   const regexp = /<<(.*?)>>|\{\{(.*?)\}\}/;
   return template.split('\n').map( function(line) {
       for (let match = line.match(regexp), result; match;) {
	   if (match[0][0] === '<') {
		   console.log("match <");
	   } else {
	      result = vars[match[2].trim()];

	   }
           line = line.replace(match[0], result ? result : '');
	   match = line.match(regexp);
       }	       
       return line;
   }).join('\n');	
}

app.get('/web/device/:id', async (req,res) => {
    var template = "<html>"+
                     "<head><title>Sensor {{name}}</title></head>" +
                     "<body>" +
		        "<h1>{{ name }}</h1>"+
		        "id  : {{ id }}<br/>" +
		        "Key : {{ key }}" +
                     "</body>" +
                "</html>";


    var device = await db.query("SELECT * FROM devices WHERE device_id = '"+req.params.id+"'");
    console.log(device.rows[0]);
    res.send(render(template,{id:device.rows[0].device_id, key: device.rows[0].key, name:device.rows[0].name}));
});	


app.get('/term/device/:id', async (req, res) => {
    var red = "\33[31m";
    var green = "\33[32m";
    var blue = "\33[33m";
    var reset = "\33[0m";
    var template = "Device name " + red   + "   {{name}}" + reset + "\n" +
		   "       id   " + green + "       {{ id }} " + reset +"\n" +
	           "       key  " + blue  + "  {{ key }}" + reset +"\n";
    var device = await db.query("SELECT * FROM devices WHERE device_id = '"+req.params.id+"'");
    console.log(device.rows);
    res.send(render(template,{id:device.rows[0].device_id, key: device.rows[0].key, name:device.rows[0].name}));
});

app.get('/measurement', async (req,res) => {
    res.send(await getMeasurements());
});

app.get('/device', async (req,res) => {
    var devices = await db.query("SELECT * FROM devices");
    res.send( devices.rows);
});

app.get('/admin/:command', function(req,res) {
    var msg="done";
    switch (req.params.command) {
       case "clear":
         if (req.query.db == "mongo") {
           msg = "clearing mongo";
           /* UNIMPLEMENTED */
	 } else if (req.query.db == "psql") {
           msg = "clearing psql";
           /* UNIMPLEMENTED */
	 } else {
           msg = "unknown db " + req.query.db;
         }
       break;
       case "save":
         if (req.query.db == "mongo") {
           msg = "saving mongo to " + req.query.file;
           /* UNIMPLEMENTED */
	 } else if (req.query.db == "psql") {
           msg = "saving psql " + req.query.file;
           /* UNIMPLEMENTED */
	 } else {
           msg = "unknown db " + req.query.db;
         }
       break;
       case "show":
         msg = fs.readFileSync("../fixtures/" + req.query.file);
       break;
 
       break;
       default:
         msg="Command: " + req.params.command + " not implemented"
    }
    var template = "<html>"+
                     "<head><title>Admin</title></head>" +
                     "<body>" +
                        "{{ msg }}"+
                     "</body>" +
                "</html>";
    res.send(render(template,{msg:msg}));
});	


startDatabase().then(async() => {
    //await insertMeasurement({id:'00', t:'18', h:'78', p: '0'});
    //await insertMeasurement({id:'00', t:'19', h:'77', p: '0'});
    //await insertMeasurement({id:'00', t:'17', h:'77', p: '0'});
    //await insertMeasurement({id:'01', t:'17', h:'77', p: '0'});
    
    //console.log("mongo measurement database Up");

    //db.public.none("CREATE TABLE devices (device_id VARCHAR, name VARCHAR, key VARCHAR)");
    //db.public.none("INSERT INTO devices VALUES ('00', 'Fake Device 00', '123456')");
    //db.public.none("INSERT INTO devices VALUES ('01', 'Fake Device 01', '234567')");
    //db.public.none("INSERT INTO devices VALUES ('36:215:235:15:96:132', 'ESP32-bmp280', '$&,.123')");
    //db.public.none("CREATE TABLE users (user_id VARCHAR, name VARCHAR, key VARCHAR)");
    //db.public.none("INSERT INTO users VALUES ('1','Ana','admin123')");
    //db.public.none("INSERT INTO users VALUES ('2','Beto','user123')");

    //db.query("INSERT INTO devices VALUES ('00', 'Fake Device 00', '123456')")
    //db.query("INSERT INTO devices VALUES ('01', 'Fake Device 01', '234567')");
    //db.query("INSERT INTO devices VALUES ('36:215:235:15:96:132', 'ESP32-bmp280', '$&,.123')");
    //db.query("INSERT INTO users VALUES ('1','Ana','admin123')");
    //db.query("INSERT INTO users VALUES ('2','Beto','user123')");
    
    //console.log("sql device database up");

    app.listen(PORT, () => {
        console.log(`Listening at ${PORT}`);
    });
});
