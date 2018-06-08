module.exports = function(requestObject){
	
	// I could pass in the route name and have different switch statements depending on route name
	switch(requestObject.query.error)
	{
		case '1':
			return "That email is already taken. Please try again.";
		case '2':
			return "Password and password confirmation do not match";
		case '3':
			return "Only .png files are allowed!";
		case '4':
			return "File Upload failed. Navigate back to the login page and try registering again.";
		case '5':
			return "File Size too big. Please choose a smaller file."
		case '6':
			return "Invalid email. Please type a valid email address.";
		case '7':
			return "Invalid characters in name. Please use only alphanumeric characters.";
		case '8':
			return "Invalid characters in file name. Please use only alphanumeric characters.";
		default:
			return null;
	}
};