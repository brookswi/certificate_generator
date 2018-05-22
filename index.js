var express = require('express')
var async = require('async')
var exphbs  = require('express-handlebars');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var morgan = require('morgan');
var User = require('./models/user').User;
var adminUser = require('./models/user').adminUser;
var sequelize = require('./models/user').sequelize;
var award = require('./models/user').award;

//configure app
var app = express();

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

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

// Handle form for registration
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

	if (req.body.type == "regular")
	{
		// Save the new user 
		User.create({
			full_name: req.body.name,
			email: req.body.email,
			passwrd: req.body.password
		}).then(user => {
			req.session.user = user.dataValues; 
			return res.redirect('/dashboard');
		});
	}
});

app.get('/login', function (req, res) {
	res.render('login')
});

app.get('/dashboard', function (req, res) {
	res.render('dashboard')
});

app.get('/adminDashboard', async (req, res) => {
	var response = {}
	await sequelize.query('SELECT * FROM reg_user', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.regUsers = results; 
	}); 
	await sequelize.query('SELECT * FROM admin_user', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.adminUsers = results;  
	});  
	res.render('adminDashboard', response);  
});


app.post('/adminUser/addUser', (req, res) => {
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

	if (req.body.type == "regular")
	{
		// Save the new user 
		User.create({
			full_name: req.body.name,
			email: req.body.email,
			passwrd: req.body.password
		}).then(() => { 
			return res.redirect('/adminDashboard');
		});
	}
	else if (req.body.type == "admin")
	{
		// Save the new admin user
		adminUser.create({ 
			email: req.body.email,
			passwrd: req.body.password
		}).then(() => { 
			return res.redirect('/adminDashboard');
		});
	}
});


app.post('/adminUser/action', (req, res) => {

	var action = req.body.action, 
		name = req.body.name,
		email = req.body.email, 
		type = req.body.type,
		id = req.body.id;

	// Delete user
	if (action == "Delete")
	{
		if (type == "regular")
		{
			sequelize.query('DELETE FROM reg_user WHERE full_name = \'' + name + '\' AND email = \'' + email + '\'', { type: sequelize.QueryTypes.DELETE }).then(() => 
				{       
					return res.redirect('/adminDashboard'); 
				});         
		}
		else if (type == "admin")
		{
			sequelize.query('DELETE FROM admin_user WHERE email = \'' + email + '\'', { type: sequelize.QueryTypes.DELETE }).then(() => 
				{       
					return res.redirect('/adminDashboard'); 
				});         
		}
	}

	// Edit user
	if (action == "Edit")
	{
		if (type == "regular")
		{
			sequelize.query('UPDATE reg_user SET full_name = \'' + name + '\', email = \'' + email + '\' WHERE user_id = \'' + id + '\'', { 
				type: sequelize.QueryTypes.DELETE }).then(() => {        
					return res.redirect('/adminDashboard'); 
				});         
		}
		else if (type == "admin")
		{
			sequelize.query('UPDATE admin_user SET email = \'' + email + '\' WHERE admin_id = \'' + id + '\'', { 
				type: sequelize.QueryTypes.DELETE }).then(() => {        
					return res.redirect('/adminDashboard'); 
				});         
		}
	}

    // Account summary
    if (action == "Account Summary")
    {
        res.redirect('/accountSum/?id=' + id);
    }
         
});

app.get('/accountSum', async (req, res) => {
    var id = req.query.id;

	var response = {}
	await sequelize.query('SELECT A.user_id, A.recipient, A.email, A.award_date, AT.type_name FROM award A ' +
    'INNER JOIN award_type AT ON A.type_id = AT.type_id WHERE A.user_id = \'' + id + '\'', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.awards = results; 
	}); 
    await sequelize.query('SELECT AT.type_name, COUNT(AT.type_name) AS type_count FROM award A ' +
    'INNER JOIN award_type AT ON A.type_id = AT.type_id WHERE A.user_id = \'' + id + '\' GROUP BY AT.type_name', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.awardStats = results; 
	}); 
	res.render('accountSummary', response);  
});


app.post('/addAward', (req, res) => {
	console.log(req.session.user.user_id);
	var awardType = req.body.type,
		awardID = 0,
		userID = req.session.user.user_id;
	if (awardType == "bronze")
	{
		awardID = 1;
	}
	if (awardType == "silver")
	{
		awardID = 2;
	}
	if (awardType == "gold")
	{
		awardID = 3;
	}
	if (awardType == "diamond")
	{
		awardID = 4;
	}
	
	award.create({
			recipient: req.body.name,
			email: req.body.email,
			type_id: awardID,
			user_id: userID,
		}).then(() => { 
			return res.redirect('/dashboard');
		});


});

app.post('/user/login', (req, res) => {

	var email = req.body.email,
		password = req.body.password,
		type = req.body.type; 

	if (type == "regular")
	{     
		User.findOne({ where: { email: email, passwrd: password } }).then(function (user) {
			if (!user) {
				res.redirect('/login');
			} else {
				req.session.user = user.dataValues;
				console.log(req.session.user)
				res.redirect('/dashboard');
			}
		});
	}
	else if (type == "admin")
	{ 
		adminUser.findOne({ where: {email: email, passwrd: password } }).then(function (user) {
			if (!user) {
				res.redirect('/login');
			} else {
				req.session.user = user.dataValues;               
				console.log(req.session.user);
				res.redirect('/adminDashboard');
			}
		}); 
	}    
});

app.get('/logout', (req, res) => {
	if (req.session.user && req.cookies.user_sid) {
		res.clearCookie('user_sid');
		res.redirect('/');
	} else {
		res.redirect('/login');
	}
});

//start server
const port = process.env.PORT || 8080;
app.listen(port, function () {
	console.log('Example app started up!')
});

