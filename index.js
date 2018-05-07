var express = require('express')
var exphbs  = require('express-handlebars');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var morgan = require('morgan');
var User = require('./models/user');

//configure app
var app = express();

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
	key: 'user_sid',
	secret: 'somerandonstuffs',
	resave: false,
	saveUninitialized: false,
	cookie: {
		expires: 600000
	}
}));

app.use((req, res, next) => {
	if (req.cookies.user_sid && !req.session.user) {
		res.clearCookie('user_sid');        
	}
	next();
});

var sessionChecker = (req, res, next) => {
	if (req.session.user && req.cookies.user_sid) {
		res.redirect('/dashboard');
	} else {
		next();
	}
};

app.get('/', sessionChecker, (req, res) => {
	res.render('index');
});

//handle form for registration
app.post('/user/register', (req, res) => {
	if (req.body.password !== req.body.passwordConfirmation) {
		return res.render('index', {
			errors: ['Password and password confirmation do not match'],
		});
	}
	if (req.body.password.length < 1) {
		const err = 'Bad password';
		return res.render('index', {
			errors: [err],
		});
	}

	// Save the new user 
	User.create({
		full_name: req.body.name,
		email: req.body.email,
		passwrd: req.body.password
	}).then(user => {
		req.session.user = user.dataValues;
		return res.redirect('/dashboard');
	});
});

app.get('/login', function (req, res) {
	res.render('login')
})

app.get('/dashboard', function (req, res) {
	res.render('dashboard')
})



app.post('/user/login', (req, res) => {
	var email = req.body.email,
		password = req.body.password;
	User.findOne({ where: { email: email, passwrd: password } }).then(function (user) {
		if (!user) {
			res.redirect('/login');
		} else {
			req.session.user = user.dataValues;
			res.redirect('/dashboard');
		}
	});

});

//start server
const port = process.env.PORT || 8080;
app.listen(port, function () {
	console.log('Example app started up!')
})

