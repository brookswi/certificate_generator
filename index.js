/*
//https://devcenter.heroku.com/articles/getting-started-with-nodejs#provision-a-database
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});


app.get('/db', async (req, res) => {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT * FROM reg_user');
    res.render('pages/db', result);
    client.release();
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
});
*/


var express = require('express')
var app = express()
var exphbs  = require('express-handlebars');

//configure app
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.get('/', function (req, res) {
	res.render('index')
})

app.get('/register', function (req, res) {
	res.render('register')
})

app.get('/login', function (req, res) {
	res.render('login')
})

//start server
const port = process.env.PORT || 8080;
app.listen(port, function () {
  console.log('Example app started up!')
})

