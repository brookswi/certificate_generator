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

