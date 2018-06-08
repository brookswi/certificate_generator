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
const emailValidator = require("email-validator");
var jsonWrapper = require('./util/jsonWrapper.js');
var jsonToTexWrapper = require('./util/jsonToTexWrapper.js');
var pdfLatexWrapper = require('./util/pdfLatexWrapper.js');
var nodemailerWrapper = require('./util/nodemailerWrapper.js');
var imageFileWrapper = require('./util/imageFileWrapper.js');
var removeFileWrapper = require('./util/removeFileWrapper.js');
var displayError = require('./util/displayError.js');
var latexValidator = require('./util/latexValidator.js');
var validateUserErrors = require('./util/validateUserErrors.js');
const maxImageFileSize = 5120;
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
		console.log(req.session.user);
		res.redirect('/dashboard');
	} else {
		console.log(req.session.user);
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
	limits: {fileSize: maxImageFileSize + 1}, 
	fileFilter: function (req, file, cb) {
		sequelize.query('SELECT email FROM reg_user WHERE email = ?', {replacements: [req.body.email], type: sequelize.QueryTypes.SELECT})
			.then(user => {				
				// send an action in the req.body to differentiate whether it's an upload from register, add user, or change signature
				if (req.body.action === "Create Account" || req.body.action === "Add User")
				{
					if (user.length) {
						req.emailInUseError = "Email already in use";
						cb(null, false, new Error("Email already in use"));
					}
					else if (emailValidator.validate(req.body.email) === false) {
						req.invalidEmailError = "Invalid email";
						cb(null, false, new Error("Invalid email"));
					}
					else if (latexValidator(req.body.full_name) == true){
						req.invalidCharactersName = "Invalid characters in Name";
						cb(null, false, new Error("Invalid characters in Name"));
					}
					else if(req.body.password !== req.body.passwordConfirmation) 
					{
						req.passwordsDoNotMatchError = "Passwords do not match";
						cb(null, false, new Error("Passwords do not match"));
					}
					else if (latexValidator(file.originalname) === true){
						req.invalidCharactersFileName = "Invalid characters in File Name";
						cb(null, false, new Error("Invalid characters in File Name"));
					}
					else if (path.extname(file.originalname).toLowerCase() !== ".png")
					{
						req.incorrectFileTypeError = "Image is not png file";
						cb(null, false, new Error("Image is not png file"));
					}
					else
					{ 
						cb(null, true);
					}
				}
				else if (req.body.action === "Upload" || req.body.action === "Change")
				{
					// this is coming from change signature
					if (path.extname(file.originalname).toLowerCase() !== ".png")
					{
						req.incorrectFileTypeError = "Image is not png file";
						cb(null, false, new Error("Image is not png file"));
					}
					else if (latexValidator(file.originalname) === true){
						req.invalidCharactersFileName = "Invalid characters in File Name";
						cb(null, false, new Error("Invalid characters in File Name"));
					}
					else{
						cb(null, true);
					}
				}

			});
	}
}).single('imgUploader');

// Handle form for registration
app.post('/user/register', (req, res) => {
	upload(req, res, function(err){
		var validateUserErrorCode = validateUserErrors(req, maxImageFileSize);
		if (validateUserErrorCode !== null){
			return res.redirect('/register?error=' + validateUserErrorCode);
		}
		else{
			// create Signature
			filename = Date.now() + "_" + req.file.originalname;
			signature.create({
				signature_name: filename,
				img_file: req.file.buffer
			}).then(signature => {
				// create User
				return User.create({
					full_name: req.body.name,
					email: req.body.email,
					passwrd: req.body.password,
					signature_id: signature.dataValues.signature_id
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

app.get('/loginFail', function (req, res) {
    res.render('loginFail');
});

app.get('/register', function (req, res) {
	var response = {};
	response.error = displayError(req);
    res.render('register');
});

app.get('/dashboard', function (req, res) {
	var response = {};
	if (req.session.user !== undefined){
		userID = req.session.user.user_id;
		response.id = userID;
	}
	else{
		return res.redirect('/');
	}


    // User not signed in
	if (userID === null) {
		return res.redirect('/');
	}

    // User signed in
	else {
        // Get user info
		response.error = displayError(req);
		sequelize.query('SELECT full_name FROM reg_user WHERE user_id = ?', {replacements: [userID], type: sequelize.QueryTypes.SELECT})
		.then(results => {
			response.full_name = results[0].full_name;

            // Get info on awards user has given
			return sequelize.query('SELECT A.award_id, A.recipient, A.email AS recipient_email, A.award_date, AT.type_name FROM award A ' + 'INNER JOIN award_type AT ON A.type = AT.type_id WHERE A.user_id = ' + userID, {type: sequelize.QueryTypes.SELECT});})
		.then(results => {
			console.log(results);
			response.awards = results;

            // Render dashboard with user info
			res.render('dashboard', response);
		}).catch(function(error){
			console.log(error);
			return res.redirect('/');
		});
	}
});

app.get('/profileInfo', async (req, res) => {
    var response = {};
	if (req.session.user !== undefined){
		userID = req.session.user.user_id;
		response.id = userID;
	}
	else{
		return res.redirect('/');
	}


    // User not signed in
	if (userID === null) {
		return res.redirect('/');
	}
	else{
		// Get user info
		response.error = displayError(req);
		sequelize.query('SELECT * FROM reg_user WHERE user_id = ?', {replacements: [userID], type: sequelize.QueryTypes.SELECT})
		.then(results => {
			response.full_name = results[0].full_name;
			response.email = results[0].email;
			response.createdAt = results[0].createdAt;
			response.updatedAt = results[0].updatedAt;
			response.signature_id = results[0].signature_id;
			
			// Render profile page with user info
			return res.render('profile', response);
		});
	}
});
    


app.get('/adminDashboard', async (req, res) => {
	
	// all admin pages need to use a session, otherwise you can access them by just typing in the route without logging in
	
	var response = {};
	var rawSQL = "SELECT RU.full_name, RU.email, RU.\"createdAt\", RU.\"updatedAt\", RU.signature_id, S.signature_name " + 
	"FROM reg_user as RU " +
	"INNER JOIN signature as S ON RU.signature_id = S.signature_id";
	await sequelize.query(rawSQL, { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.regUsers = results; 
	}); 
	await sequelize.query('SELECT * FROM admin_user', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.adminUsers = results;  
	});  
	res.render('adminDashboard', response);  
});

app.get('/manageReg', async (req, res) => {
    var response = {};
	
	response.error = displayError(req);
	
    await sequelize.query('SELECT * FROM reg_user', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.regUsers = results; 
	}); 

    res.render('manageReg', response);
});

app.get('/adminChangeSig', async(req, res) => {
	var response = {};
	response.error = displayError(req);
	
	var rawSQL = "SELECT RU.full_name, RU.signature_id, \"S\".signature_id, \"S\".signature_name, \"S\".\"createdAt\", \"S\".\"updatedAt\" " + 
	"FROM reg_user as RU " +
	"INNER JOIN signature as \"S\" ON RU.signature_id = \"S\".signature_id";
	await sequelize.query(rawSQL, { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.regUsers = results; 
	}); 
	res.render('adminChangeSig', response);
});

app.get('/manageAdmin', async (req, res) => {
    var response = {};
    await sequelize.query('SELECT * FROM admin_user', { type: sequelize.QueryTypes.SELECT }).then(results => {
		response.adminUsers = results; 
	}); 
    res.render('manageAdmin', response);
});


app.post('/adminUser/addUser', (req, res) => {
    // Add regular user
	upload(req, res, function(err){
		var validateUserErrorCode = validateUserErrors(req, maxImageFileSize);
		if (validateUserErrorCode !== null){
			return res.redirect('/manageReg?error=' + validateUserErrorCode);
		}
		else{
			// create Signature
			filename = Date.now() + "_" + req.file.originalname;
			signature.create({
				signature_name: filename,
				img_file: req.file.buffer
			}).then(signature => {
				// create User
				return User.create({
					full_name: req.body.name,
					email: req.body.email,
					passwrd: req.body.password,
					signature_id: signature.dataValues.signature_id
				});
			}).then(user => {
				return res.redirect('/manageReg');
			}).catch(function(err){
				console.log(err);
				return res.redirect('/manageReg');
			});
		}
	});
});

app.post('/adminUser/addAdminUser', (req, res) => {
	
	// should we have an email in use error for admin users too?
	
	// Check that password and password confirmation match
	if (req.body.password !== req.body.passwordConfirmation) {
		return res.render('index', {
			errors: ['Password and password confirmation do not match']
		});
	}
    
    // Check for valid password
	if (req.body.password.length < 1) {
		const err = 'Bad password';
		return res.render('index', {
			errors: [err]
		});
	}
	
	    // Add admin user
	if (req.body.type == "admin")
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
        // Regular User
		if (type == "regular")
		{
			// Delete award, then user, then signature
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

        // Admin User
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
        // Regular User
		if (type == "regular")
		{
			if (latexValidator(name) === true){
				req.invalidCharactersName = "Invalid characters in Name";
				var validateUserErrorCode = validateUserErrors(req, maxImageFileSize);
				return res.redirect('/manageReg?error=' + validateUserErrorCode);
			}
			
			if (emailValidator.validate(req.body.email) === false){
				req.invalidEmailError = "Invalid email";
				var validateUserErrorCode = validateUserErrors(req, maxImageFileSize);
				return res.redirect('/manageReg?error=' + validateUserErrorCode);
			}
			
			User.update(
			{
				full_name: name,
				email: email
			}, 
			{
				where: {user_id: id}
			}). then( () =>{
				return res.redirect('/manageReg'); 
			});			
		}

        // Admin User
		else if (type == "admin")
		{
			
			adminUser.update(
			{
				email: email
			}, 
			{
				where: {admin_id: id}
			}). then( () =>{
				return res.redirect('/manageAdmin'); 
			});			
		}
	}
});



app.get('/awardHistory', async (req, res) => {
    var response = {};

    // Get all awards
    await sequelize.query('SELECT A.recipient, A.email AS recipient_email, A.award_date, AT.type_name, RU.full_name, RU.email AS sender_email FROM award A ' + 'INNER JOIN award_type AT ON A.type = AT.type_id INNER JOIN reg_user RU ON A.user_id = RU.user_id', {type: sequelize.QueryTypes.SELECT}).then(results => {
        response.awards = results;
    });
    res.render('awardHistory', response);
});

app.post('/changeName', (req, res) => {
	var name = req.body.name;
	var id = req.body.id;
	// validate name
	if (latexValidator(name) === true){
		req.invalidCharactersName = "Invalid characters in Name";
		var validateUserErrorCode = validateUserErrors(req, maxImageFileSize);
		return res.redirect('/profileInfo?error=' + validateUserErrorCode);
	}
	
	User.update(
	{
		full_name: name
	}, 
	{
		where: {user_id: id}
	}).then ( () => {
		return res.redirect('/profileInfo'); 
	});  
});

app.post('/deleteAward', (req, res) => {
	var award_id = req.body.award_id;
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
	
	// perform validations on recipient name
	if (latexValidator(req.body.name) === true){
		req.invalidCharactersName = "Invalid characters in Name";
		var validateUserErrorCode = validateUserErrors(req, maxImageFileSize);
		return res.redirect('/dashboard?error=' + validateUserErrorCode);
	}
	// perform validations on recipient email
	if (emailValidator.validate(req.body.email) === false){
		req.invalidEmailError = "Invalid email";
		var validateUserErrorCode = validateUserErrors(req, maxImageFileSize);
		return res.redirect('/dashboard?error=' + validateUserErrorCode);
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
		})
		.then(fileObj =>{
			return removeFileWrapper(fileObj);
		})
		.then(fileObj =>{
			console.log(fileObj);
			return res.redirect('/dashboard');
		}).catch(function(error){
			console.log(error);
			return res.redirect('/dashboard');
		});
		
});

app.post('/resendAward', (req, res) => {
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
	sequelize.query(rawSQL, {replacements: [req.body.award_id], type: sequelize.QueryTypes.SELECT})
	.then(certificate =>{
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
	})
	.then(fileObj =>{
		return removeFileWrapper(fileObj);
	})
	.then(fileObj =>{
		console.log(fileObj);
		return res.redirect('/dashboard');
	}).catch(function(error){
		console.log(error);
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

    // Regular user
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

    // Admin user
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


app.post('/changeSignature', (req, res) => {
	upload(req, res, function(err){
		var redirectUrl;	
		
		// check action to see where it's coming from
		if (req.body.action === "Upload"){
			redirectUrl = '/profileInfo';
		}
		else if (req.body.action === "Change"){
			redirectUrl = '/adminChangeSig';
		}
		else{
			return res.redirect('/');
		}
		// update signature name and buffer
		var validateUserErrorCode = validateUserErrors(req, maxImageFileSize);
		if (validateUserErrorCode !== null){
			return res.redirect(redirectUrl + "?error=" + validateUserErrorCode);
		}
		else{
			var filename = Date.now() + "_" + req.file.originalname;
			var buffer = req.file.buffer;
			var sig_id = req.body.signature_id;
			
			signature.update(
			{
				signature_name: filename,
				img_file: buffer
			}, 
			{
				where: {signature_id: sig_id}
			}).then(() =>{
				return res.redirect(redirectUrl);
			});
		}
 
	});
});


app.get('/logout', (req, res) => {
	if (req.session.user && req.cookies.user_sid) {
		res.clearCookie('user_sid');
		res.redirect('/');
	} else {
		res.redirect('/');
	}
});

app.use(function(req,res){
  res.status(404);
  res.render('404');
});

app.use(function(err, req, res, next){
  console.error(err.stack);
  res.type('plain/text');
  res.status(500);
  res.render('500');
});

//start server
const port = process.env.PORT || 8080;
app.listen(port, function () {
	console.log('Example app started up!')
});

