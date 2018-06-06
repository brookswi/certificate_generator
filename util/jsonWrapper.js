const fs = require('fs');
module.exports = function(jsonString, fileObj){
	return new Promise((resolve, reject) => {
		fs.writeFile(fileObj.input_file, jsonString, (err) => {
			if (err) reject(err);
			else{
				resolve(fileObj);
			}
		});
	});
};