var express = require('express');
var pg = require('pg');
var sha1 = require('sha1');

var conString = "postgres://oxlwjtfpymhsup:oGVMzhwCjspYEQrzNAmFPrwcx7@ec2-107-21-102-69.compute-1.amazonaws.com:5432/d4edc2620msf51?ssl=true";

var adminUser = "admin"

var adminPass = "adminpass"


module.exports = function (app) {
    /* Log in Post */

    
    app.post('/postings.html', function (req, res) {
        var userEmail = req.body.email;
        var userPass = req.body.password;
        var result = [];
        var passFound = false;
        var client = new pg.Client(conString);
        var dbPass = [];
        
        //check if user is admin
        
        if (userEmail == adminUser){
            //check password
            if (userPass == adminPass){
                req.session.user = userEmail;
                res.redirect('/admin.html');
            }
            
            else{
                //incorrect password for admin
                res.send('There was an error in log in ' + userEmail + ' and ' + userPass);
            }
        }
                   
        else{
            client.connect(function (err, done) {
                if (err) {
                    return console.error('Could not connect to postgres', err);
                    res.send('Sorry, there was an error', err);
                }

                // Query to check if the user exists
                var query = client.query('SELECT "Password", "UserId" FROM "User" WHERE "Email"=$1', [userEmail]);

                query.on('error', function (err) {
                    res.send('Query Error ' + err);
                });
                query.on('row', function (row) {
                    //User Does exist
                    dbPass.push(row.Password);
                    result.push(row.UserId);
                    passFound = true;
                });
                query.on('end', function () {
                    client.end();

                    if (passFound == false) {
                        res.send('There was no user with that email');

                    // Check if the passwords match (Really ugly user validation)
                    } else if (dbPass[0] == sha1(userPass)) {
                        // Login Success!

                        // Log the Users email and UserId in the session to access later
                        req.session.user = userEmail;
                        req.session.uid = result[0];

                        //console.log('Session log for userid ' + req.session.uid);
                        res.redirect('postings.html');

                    // Username and password did no match
                    } else if (dbPass[0] != userPass) {
                        res.send('There was an error in log in ' + dbPass[0] + ' != ' + sha1(userPass));
                    }
                });
            });
        }
    });
};