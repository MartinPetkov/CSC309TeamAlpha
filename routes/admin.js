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
    
    app.get('/getSpaces?', function (req, res){
        successMessage = "retrieved teams count";
        failedMessage = "failed to retrieve teams count";
        dbQuery = 'SELECT count("SpaceName") as "spaceCount" FROM "Space"';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
        
    });
    
    app.get('/getMembers?', function (req, res){
        successMessage = "retrieved members count";
        failedMessage = "failed to retrieve members count";
        dbQuery = 'SELECT count("Email") as "emailCount" FROM "User"';
        executeQuery(res, req, successMessage, failedMessage, dbQuery, []);
    });
        
    
    function executeQuery(res,req, successMessage, failedMessage, dbQuery, values, results_handler) {
        var client = new pg.Client(conString);
        var result = [];
        var result_rows = [];
        client.connect(function (err, done) {
            if(err) {
                console.error('Could not connect to the database', err);
                res.writeHead(500);
                res.end('A server error occurred' + err);
            }

            // Prevent XSS
            for(var i = 0; i < values.length; i++) {
                if(typeof values[i] == 'string') {
                    values[i] = sanitizer.escape(values[i]);
                }
            }

            var query = client.query(dbQuery, values, function(err, result){});
            //console.log('executing a query '+values);

            query.on('error', function (error) {
                res.writeHead(500);
                console.log(failedMessage);
                console.log(error);
                res.end();
            });

            query.on('row', function (row){
                result.push(row);
            });

            query.on('end', function (result){
                client.end();
                console.log(successMessage);
                if(!(typeof results_handler == 'undefined')) {
                    results_handler(result, res, req);

                } else {
                    res.writeHead(200, {'Content-Type': 'text/plain'});

                    var jsonShit = {};
                    jsonShit.results = result.rows;
                    console.log(jsonShit.results[0]);
                    res.write(JSON.stringify(jsonShit, 0, 4));
                    res.end();
                }
            });
        });
    }

};