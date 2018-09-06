var nodemailer = require('nodemailer');
module.exports = function(fileObj){
	return new Promise ((resolve, reject) =>{
		
		var transporter = nodemailer.createTransport({
		 service: 'gmail',
		 auth: {
				user: 'certificategenerator123@gmail.com',
				pass: 'certgen792'
			},
		tls: {
				rejectUnauthorized: false
			}
		});
		
		const mailOptions = {
				from: 'certificategenerator123@gmail.com', // sender address
  				to: fileObj.recipient_email, // list of receivers
  				subject: 'Award Certificate', // Subject line
  				html: 'Congratulations! Attached is your certificate.', // plain text body
				attachments:[
				{
					path: './' + fileObj.pdf_file
				}
				]
			};

			transporter.sendMail(mailOptions, function (err, info) {
   				if(err){
					reject(err);
				}
   				else{
					fileObj.info = info;
					resolve(fileObj);
				}
     					
			});
	});
};

