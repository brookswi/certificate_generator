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
var signature = require('./models/user').signature;
var nodemailer = require('nodemailer');
var multer = require('multer');
const path = require("path");
const fs = require("fs");
var jsonWrapper = require('./util/jsonWrapper.js');
var jsonToTexWrapper = require('./util/jsonToTexWrapper.js');
var pdfLatexWrapper = require('./util/pdfLatexWrapper.js');
var nodemailerWrapper = require('./util/nodemailerWrapper.js');
var imageFileWrapper = require('./util/imageFileWrapper.js');
var removeFileWrapper = require('./util/removeFileWrapper.js');

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

 // handle image upload: using memoryStorage to get the buffer
const storage = multer.memoryStorage();

var upload = multer({storage: storage, 
	fileFilter: function (req, file, cb) {
		sequelize.query('SELECT email FROM reg_user WHERE email = ?', {replacements: [req.body.email], type: sequelize.QueryTypes.SELECT})
			.then(user => {
				if (user.length) {
					req.emailInUseError = "Email already in use";
					cb(null, false, new Error("Email already in use"));
				}
				else if(req.body.password !== req.body.passwordConfirmation) {
					req.passwordsDoNotMatchError = "Passwords do not match";
					cb(null, false, new Error("Passwords do not match"));
				}
				
				else if (path.extname(file.originalname).toLowerCase() !== ".png"){
					req.incorrectFileTypeError = "Image is not png file";
					cb(null, false, new Error("Image is not png file"));
				}
				else{ 
					cb(null, true);
				}
			});
	}
}).single('imgUploader');

// Handle form for registration
app.post('/user/register', (req, res) => {
	upload(req, res, function(err){
		// there's a weird bug where if one of the error cases happen below and it redirects back to a
		// page with a form, then in subsequent posts, req.file will be undefined
		// I could not figure out a fix but I did make a workaround by redesigning the registerFail page
		if (req.emailInUseError){
			console.log(err);
			return res.redirect('/registerFail?error=1'); 
		}
		else if (req.passwordsDoNotMatchError){
			console.log(err);
			return res.redirect('/registerFail?error=2'); 
		}
		else if (req.incorrectFileTypeError){
			console.log(err);
			return res.redirect('/registerFail?error=3'); 
		}
		else{
			// create Signature
			filename = Date.now() + "_" + req.file.originalname;
			sequelize.query("INSERT INTO signature (signature_name, img_file) VALUES (?, ?)", {replacements: [filename, req.file.buffer]})
			.then(signature => {
				return sequelize.query("SELECT signature_id FROM signature WHERE signature_name = ?", {replacements: [filename], type: sequelize.QueryTypes.SELECT});
			}).then(signature => {
				// create User
				return User.create({
					full_name: req.body.name,
					email: req.body.email,
					passwrd: req.body.password,
					signature_id: signature[0].signature_id
				});
			}).then(user => {
				req.session.user = user.dataValues; 
				return res.redirect('/dashboard');
			}).catch(function(err){
				console.log(err);
				return res.redirect('/');
			});
		}
	});
});

app.get('/login', function (req, res) {
	res.render('login');
});

app.get('/loginFail', function (req, res) {
    res.render('loginFail');
});

app.get('/register', function (req, res) {
    res.render('register');
});

app.get('/registerFail', function (req, res) {
	var response = {};
	response.redirectUrl = '/register';
	switch(req.query.error)
	{
		case '1':
			response.error = "That email is already taken. Please try again.";
			break;
		case '2':
			response.error = "Password and password confirmation do not match";
			break;
		case '3':
			response.error = "Only .png files are allowed!";
			break;
		case '4':
			response.error = "File Upload failed. Navigate back to the login page and try registering again.";
			break;
		default:
			response.error = "Oops, something went wrong.";
			break;
	}
	
    res.render('registerFail', response);
});

app.get('/dashboard', async (req, res) => {
	var response = {},
		userID = req.session.user.user_id;
	response.id = userID;
	if (userID === null){
		res.redirect('/');
	}
	else{
		sequelize.query('SELECT full_name FROM reg_user WHERE user_id = ?', {replacements: [userID], type: sequelize.QueryTypes.SELECT})
		.then(results => {
			response.full_name = results[0].full_name;
			return sequelize.query('SELECT A.award_id, A.recipient, A.email AS recipient_email, A.award_date, AT.type_name FROM award A ' + 'INNER JOIN award_type AT ON A.type = AT.type_id WHERE A.user_id = ' + userID, {type: sequelize.QueryTypes.SELECT});})
		.then(results => {
			response.awards = results;
			res.render('dashboard', response);
		}).catch(function(error){
			console.log(error);
			res.redirect('/');
		});
	}
});

app.get('/profileInfo', async (req, res) => {
    var response = {},
        userID = req.session.user.user_id;
    response.id = userID;
    await sequelize.query('SELECT * FROM reg_user WHERE user_id = ?', {replacements: [userID], type: sequelize.QueryTypes.SELECT})
	.then(results => {
		response.full_name = results[0].full_name;
        response.email = results[0].email;
        response.createdAt = results[0].createdAt;
	});
    res.render('profile', response);
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
		id = req.body.id,
		signature_id = req.body.signature_id;

	// Delete user
	if (action == "Delete")
	{
		if (type == "regular")
		{
			// delete award, then user, then signature
			sequelize.query("DELETE FROM award WHERE user_id= ?", { replacements: [id], type: sequelize.QueryTypes.DELETE})
			.then(result => {
				return sequelize.query('DELETE FROM reg_user WHERE user_id = ?', { replacements: [id], type: sequelize.QueryTypes.DELETE });
			}).then(result => {
				return sequelize.query("DELETE FROM signature WHERE signature_id = ?", { replacements: [signature_id], type: sequelize.QueryTypes.SELECT});
			}).then(result =>{
				return res.redirect('/manageReg'); 
			}).catch(function(error){
				console.log(error);
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

app.post('/changeName', (req, res) => {
	var name = req.body.name;
	var id = req.body.id;
	sequelize.query('UPDATE reg_user SET full_name = ? WHERE user_id = ?', { replacements: [name, id]}).then(() => {        
			return res.redirect('/profileInfo'); 
		});   
});

app.post('/deleteAward', (req, res) => {

	var award_id = req.body.id;
	sequelize.query('DELETE FROM award WHERE award_id = ?', { replacements: [award_id], type: sequelize.QueryTypes.DELETE }).then(() => 
	{       
		return res.redirect('/dashboard'); 
	});   
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
	}).then(awrd => {
			var rawSQL = "SELECT award.recipient, " +
					"award.award_id, " +
					"award.award_date, " +
					"award.email, " +
					"award.type, " +
					"reg_user.full_name, " +
					"reg_user.signature_id, " +
					"signature.signature_name, " +
					"signature.img_file " +
					"FROM award " +
					"INNER JOIN reg_user ON award.user_id = reg_user.user_id " +
					"INNER JOIN signature ON reg_user.signature_id = signature.signature_id " +
					"WHERE award.award_id = ?";
			return sequelize.query(rawSQL, {replacements: [awrd.dataValues.award_id], type: sequelize.QueryTypes.SELECT});
		}).then(certificate =>{
			// create a Buffer object to store the buffer from the database
			const buf = Buffer.from(certificate[0].img_file, 'base64');
			var type_name = "default";
			switch(certificate[0].type){
				case 1:
				type_name = "bronze";
				break;
				case 2:
				type_name = "silver";
				break;
				case 3:
				type_name = "gold";
				break;
				case 4:
				type_name = "diamond";
				break;
			}
			
			var certJSON = {
				"recipient": certificate[0].recipient,
				"award_date": certificate[0].award_date,
				"img_file": certificate[0].signature_name,
				"type_name": type_name,
				"full_name": certificate[0].full_name
			};
			var stringJson = JSON.stringify(certJSON);
			var inputFileName = 'certJSON_' + certificate[0].award_id + '.json';
			var outputFileName = 'cert_' + certificate[0].award_id + '.tex';
			var pdfFileName = 'cert_' + certificate[0].award_id + '.pdf';
			var logFile = 'cert_' + certificate[0].award_id + '.log';
			var auxFile = 'cert_' + certificate[0].award_id + '.aux';
			var fileObj = {
				input_file: inputFileName,
				output_file: outputFileName,
				pdf_file: pdfFileName,
				log_file: logFile,
				aux_file: auxFile,
				recipient_email: certificate[0].email,
				img_buffer: buf,
				sig_name: certificate[0].signature_name
			};
			return jsonWrapper(stringJson, fileObj);
		}).then(fileObj => {
			return imageFileWrapper(fileObj);
		}).then(fileObj => {
			return jsonToTexWrapper(fileObj);
		}).then(fileObj => {
			return pdfLatexWrapper(fileObj);
		}).then(fileObj => {
			return nodemailerWrapper(fileObj);
		}).then(fileObj =>{
			return removeFileWrapper(fileObj);
		}).then(fileObj =>{
			console.log(fileObj);
			return res.redirect('/dashboard');
		}).catch(function(error){
			console.log(error);
			// I think I should redirect to an error page
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
				res.redirect('/loginFail');
			} else {
				req.session.user = user.dataValues;
				res.redirect('/dashboard');
			}
		});
	}
	else if (type == "admin")
	{ 
		adminUser.findOne({ where: {email: email, passwrd: password } }).then(function (user) {
			if (!user) {
				res.redirect('/loginFail');
			} else {
				req.session.user = user.dataValues;               
				console.log(req.session.user);
				res.redirect('/adminDashboard');
			}
		}); 
	}    
});

/* ***COMING BACK TO THIS LATER***
//app.post('/changeSignature', upload.single('imgUploader'), (req, res) => {
app.post('/changeSignature', (req, res) => {
	// query for user with id to get filename
	// delete old signature image
	// update database with new file name
	// should return 404 page on failure
	if (!req.file) {
		console.log("No file received");
		return res.send({
		  success: false
		});
	  } 
	else {
		console.log('file received');
		console.log(req.file.path);
		return res.send({
		  success: true
		});
	}
});
*/

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

