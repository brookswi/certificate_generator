const { exec } = require('child_process');
module.exports = function(fileObj){
	return new Promise ((resolve, reject) =>{
		var cmd = 'rm -f ' + fileObj.output_file + 
				' ' + fileObj.input_file + 
				' ' + fileObj.pdf_file + 
				' ' + fileObj.log_file + 
				' ' + fileObj.aux_file +
				' ' + fileObj.sig_name;
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