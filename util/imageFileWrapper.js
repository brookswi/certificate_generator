const fs = require('fs');
module.exports = function(fileObj){
	return new Promise((resolve, reject) => {
		fs.writeFile(fileObj.sig_name, fileObj.img_buffer, (err) => {
			if (err) reject(err);
			else{
				resolve(fileObj);
			}
		});
	});
};
