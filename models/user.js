var Sequelize = require('sequelize');
var bcrypt = require('bcrypt');

// Create a sequelize instance with our local postgres database information.
const sequelize = new Sequelize('postgres://acpohlokgtnbip:70d592be8966d8c73c2a8faf0e035ee8183514019cb225ba80b58ebb546de181@ec2-54-83-204-6.compute-1.amazonaws.com:5432/d71g0leu4f46d0', {
	dialect:  'postgres',
	protocol: 'postgres',
	logging: true,
	dialectOptions: {
		ssl: true
	}
});

// Test database connection
sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

// Setup User model and its fields.
const User = sequelize.define('reg_user', {
	user_id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	full_name: {
		type: Sequelize.STRING,
	},
	email: {
		type: Sequelize.STRING,
	},
	passwrd: {
		type: Sequelize.STRING,
	}
},{
	tableName: 'reg_user'
});

// create all the defined tables in the specified database.
sequelize.sync()
	.then(() => console.log('users table has been successfully created, if one doesn\'t exist'))
	.catch(error => console.log('This error occured', error));

// export User model for use in other files.
module.exports = User;
