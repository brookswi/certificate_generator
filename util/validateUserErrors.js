module.exports = function(req, maxImageFileSize){
		if (req.emailInUseError){
			return '1';
		}
		else if (req.invalidEmailError) {
			return '6';
		}
		else if (req.invalidCharactersName){
			return '7';
		}
		else if (req.passwordsDoNotMatchError){
			return '2';
		}
		else if (req.incorrectFileTypeError){
			return '3';
		}
		else if (req.invalidCharactersFileName){
			return '8';
		}
		else if (req.file === undefined){
			return '4';
		}
		else if (req.file.size > maxImageFileSize){
			return '5';
		}
		else{
			return null;
		}  
};
