const { exec } = require('child_process');
module.exports = function(fileObj){
	return new Promise ((resolve, reject) =>{
		var cmd = 'pdflatex ' + fileObj.output_file;
		exec(cmd, (error, stdout, stderr) => {
			  if (error) {
				reject(error);
			  }
			  else{
			  resolve(fileObj);
			  }
		});
	});
};
