var Sequelize = require('sequelize');

// Create a sequelize instance with our local postgres database information.
const sequelize = new Sequelize('postgres://acpohlokgtnbip:70d592be8966d8c73c2a8faf0e035ee8183514019cb225ba80b58ebb546de181@ec2-54-83-204-6.compute-1.amazonaws.com:5432/d71g0leu4f46d0', {
	dialect:  'postgres',
	protocol: 'postgres',
	logging: true, // should be false for final turn in
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
var User = sequelize.define('reg_user', {
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
	},
	signature_id: {
		type: Sequelize.INTEGER,
		references: {
     		// This is a reference to another model
     			model: "signature",

     		// This is the column name of the referenced model
     			key: 'signature_id',

     		// This declares when to check the foreign key constraint. PostgreSQL only.
     			deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
   		}
	}
},{
	tableName: 'reg_user'
});

// Setup Admin User model and its fields.
var adminUser = sequelize.define('admin_user', {
	admin_id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	email: {
		type: Sequelize.STRING,
	},
	passwrd: {
		type: Sequelize.STRING,
	}
},{
	tableName: 'admin_user'
});

// award model
var award = sequelize.define('award', {
	recipient: {
		type: Sequelize.STRING,
	},
	email: {
		type: Sequelize.STRING,
	},
	award_date: {
		type: Sequelize.DATE,
	},
	award_id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	user_id: {
		type: Sequelize.INTEGER,
		references: {
     		// This is a reference to another model
     			model: "reg_user",

     		// This is the column name of the referenced model
     			key: 'id',

     		// This declares when to check the foreign key constraint. PostgreSQL only.
     			deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
   		}
	},
	type: {
		type: Sequelize.INTEGER,
		references: {
			model: "award_type",
			key:"type_id",
			deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
		}
	}
},{
	tableName: 'award'
});

var signature = sequelize.define('signature', { 
	signature_id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	signature_name: {
		type: Sequelize.STRING,
	},
	img_file: {
		type: Sequelize.BLOB,
	},
}, {
	tableName: 'signature'
});


// create all the defined tables in the specified database.
sequelize.sync()
	.then(() => console.log('User tables have been successfully created, if they don\'t already exist'))
    /*
    .then(() => adminUser.create({
        email: 'brookswi@oregonstate.edu',
        passwrd: 'testpassword123'
    }))
    */
	.catch(error => console.log('This error occured', error));


// export User models for use in other files.
module.exports = {User, adminUser, award, sequelize, signature};

