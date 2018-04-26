CREATE EXTENSION pgcrypto;

DROP TABLE IF EXISTS signature;
DROP TABLE IF EXISTS reg_user;
DROP TABLE IF EXISTS award;
DROP TABLE IF EXISTS award_type;
DROP TABLE IF EXISTS admin_user;

CREATE TABLE award_type
(
    type_id SERIAL NOT NULL,
    type_name TEXT NOT NULL,
    PRIMARY KEY (type_id)
);

CREATE TABLE signature
(
    signature_id SERIAL NOT NULL,
	img_file BYTEA NOT NULL,
    PRIMARY KEY (signature_id) 
);

CREATE TABLE admin_user
(
    admin_id SERIAL NOT NULL,
	email TEXT NOT NULL UNIQUE,
    passwrd TEXT NOT NULL,
    timestmp TIMESTAMP NOT NULL,
    PRIMARY KEY(admin_id) 
);

CREATE TABLE reg_user
(
	user_id SERIAL NOT NULL,
	email TEXT NOT NULL UNIQUE,
    passwrd TEXT NOT NULL,
    full_name TEXT NOT NULL,
    timestmp TIMESTAMP NOT NULL,
    signature_id INT NOT NULL,
	PRIMARY KEY (user_id),
    FOREIGN KEY (signature_id) REFERENCES signature (signature_id)
);

CREATE TABLE award
(
    award_id SERIAL NOT NULL,
    recipient TEXT NOT NULL, 
    email TEXT NOT NULL,
    award_date DATE NOT NULL, 
    user_id INT NOT NULL,
    type_id INT NOT NULL,
    PRIMARY KEY (award_id),
    FOREIGN KEY (user_id) REFERENCES reg_user (user_id),
    FOREIGN KEY (type_id) REFERENCES award_type (type_id)
);


