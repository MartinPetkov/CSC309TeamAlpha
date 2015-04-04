var express = require('express');
var pg = require('pg');
var sha1 = require('sha1');

var conString = "postgres://oxlwjtfpymhsup:oGVMzhwCjspYEQrzNAmFPrwcx7@ec2-107-21-102-69.compute-1.amazonaws.com:5432/d4edc2620msf51?ssl=true";


/* GET FUNCTIONS */
/* Log out functionality */
// User is only logged in through the session
module.exports = function (app) {
    app.get('/logout', function (req, res) {
        console.log(req.session.user);
        req.session.destroy(function (err) {
            if (err) {
                console.log(err);
            } else {
                res.redirect('/');
            }
        });
    });

};