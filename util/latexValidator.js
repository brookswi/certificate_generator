module.exports = function(latexString){
	var regex = /[~`!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/g;
	return regex.test(latexString);
};
