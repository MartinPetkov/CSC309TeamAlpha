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
}
    /*
    app.get('/getTeams', function (req, res){
        var client = new pg.Client(conString);
        client.connect(function (err, done) {
            if (err) {
                return console.error('could not connect to postgres', err);
                res.send('sorry, there was an error', err);
            }
            var query = client.query('SELECT * FROM "Leasing" NATURAL JOIN "Space" WHERE "TenantId"=$1', [viewUser]);
            query.on('error', function (err) {
                res.send('Query Error ' + err);
            });
            
            query.on('row', function (row) {
                spaceFound = true;
                currSpace = row.SpaceId;
                spaceResult.push(row);
                //console.log('row push ' + row.SpaceId);
                //console.log(row);
                //console.log('space result immediately post push ' + spaceResult);
                });
            query.on('end', function(){
    
    
};*/