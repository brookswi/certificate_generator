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
var nodemailer = require('nodemailer');

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

var transporter = nodemailer.createTransport({
 service: 'gmail',
 auth: {
        user: 'oregonstatecapstone@gmail.com',
        pass: 'capstone'
    }
});


// Handle form for registration
app.post('/user/register', (req, res) => {
    console.log(req.body);
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

app.get('/register', function (req, res) {
    res.render('register')
});

app.get('/dashboard', async (req, res) => {
	var response = {},
		userID = req.session.user.user_id;

    await sequelize.query('SELECT A.recipient, A.email AS recipient_email, A.award_date, AT.type_name FROM award A ' + 'INNER JOIN award_type AT ON A.type = AT.type_id WHERE A.user_id = ' + userID, {type: sequelize.QueryTypes.SELECT}).then(results => {
        response.awards = results;
    });
	res.render('dashboard', response)
});

app.get('/adminDashboard', async (req, res) => {
	var response = {};
	await sequelize.query('SELECT * FROM reg_user', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.regUsers = results; 
	}); 
	await sequelize.query('SELECT * FROM admin_user', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.adminUsers = results;  
	});  
	res.render('adminDashboard', response);  
});

app.get('/manageReg', async (req, res) => {
    var response = {};
    await sequelize.query('SELECT * FROM reg_user', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.regUsers = results; 
	}); 
    res.render('manageReg', response);
});

app.get('/manageAdmin', async (req, res) => {
    var response = {};
    await sequelize.query('SELECT * FROM admin_user', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.adminUsers = results; 
	}); 
    res.render('manageAdmin', response);
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
			return res.redirect('/manageReg');
		});
	}
	else if (req.body.type == "admin")
	{
		// Save the new admin user
		adminUser.create({ 
			email: req.body.email,
			passwrd: req.body.password
		}).then(() => { 
			return res.redirect('/manageAdmin');
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
			sequelize.query('DELETE FROM reg_user WHERE user_id = ' + id, { type: sequelize.QueryTypes.DELETE }).then(() => 
				{       
					return res.redirect('/manageReg'); 
				});         
		}
		else if (type == "admin")
		{
			sequelize.query('DELETE FROM admin_user WHERE admin_id = ' + id, { type: sequelize.QueryTypes.DELETE }).then(() => 
				{       
					return res.redirect('/manageAdmin'); 
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
					return res.redirect('/manageReg'); 
				});         
		}
		else if (type == "admin")
		{
			sequelize.query('UPDATE admin_user SET email = \'' + email + '\' WHERE admin_id = \'' + id + '\'', { 
				type: sequelize.QueryTypes.DELETE }).then(() => {        
					return res.redirect('/manageAdmin'); 
				});         
		}
	}

	// Account summary
	if (action == "Account Summary")
	{
		res.redirect('/accountSum/?id=' + id);
	}

});



app.get('/awardHistory', async (req, res) => {
    var response = {};
    await sequelize.query('SELECT A.recipient, A.email AS recipient_email, A.award_date, AT.type_name, RU.full_name, RU.email AS sender_email FROM award A ' + 'INNER JOIN award_type AT ON A.type = AT.type_id INNER JOIN reg_user RU ON A.user_id = RU.user_id', {type: sequelize.QueryTypes.SELECT}).then(results => {
        response.awards = results;
    });
    res.render('awardHistory', response);
});


app.post('/addAward', (req, res) => {
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
		award_date: req.body.date,
		type: awardID,
		user_id: userID,
	}).then(() => { 
		return res.redirect('/dashboard');
	});


});

app.post('/user/forgot', (req, res) => {
	var email = req.body.email;
	User.findOne({ where: {email: email}}).then(function (user) {
		if (user) {
			const mailOptions = {
				from: 'oregonstatecapstone@gmail.com', // sender address
  				to: email, // list of receivers
  				subject: 'Forgot Password', // Subject line
  				html: 'Password: ' + user.passwrd // plain text body
			};

			transporter.sendMail(mailOptions, function (err, info) {
   				if(err)
     					console.log(err)
   				else
     					console.log(info);
			});
		}

	});
	return res.redirect('/');
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

