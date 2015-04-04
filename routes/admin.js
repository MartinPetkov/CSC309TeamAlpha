var express = require('express');
var pg = require('pg');
var sha1 = require('sha1');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var session = require('express-session');

var https = require('https');
var fs = require('fs');
var sanitizer = require('sanitizer');

var conString = "postgres://oxlwjtfpymhsup:oGVMzhwCjspYEQrzNAmFPrwcx7@ec2-107-21-102-69.compute-1.amazonaws.com:5432/d4edc2620msf51?ssl=true";

var adminUser = "admin"

var adminPass = "adminpass"

module.exports = function (app) {
    /* Log in Admin */
    app.get('/admin.html', function (req, res){
        console.log("admin logged in");  
        res.render('admin.html');
    });
    
    
};