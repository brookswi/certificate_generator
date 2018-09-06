const { exec } = require('child_process');
module.exports = function(fileObj){
	return new Promise ((resolve, reject) =>{
		var cmd = 'python jsonToTex ' + fileObj.input_file + ' ' + fileObj.output_file + ' template.tex';
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
