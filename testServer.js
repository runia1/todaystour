/**
 * Created by mar on 12/22/16.
 */

var http = require('http');
var express = require('express');
var app = express();

var api_v1 = require('./my_modules/api-v1')();

//DEFINE THE API ENDPOINTS THAT ARE ACCESSIBLE
app.use('/api/v1', api_v1);

//DEFINE ALL STATIC ROUTES
app.use(express.static(__dirname + '/sites/user/build/bundled'));

//ROUTES NOT YET HANDLED GET FORWARDED TO INDEX
app.use('*', express.static(__dirname + '/sites/user/build/bundled/index.html'));

//INITIATE THE SERVER
var server = http.Server(app);

server.on('error', function(error) {
  console.log(error);
});

//TURN ON YOUR HTTP SERVER
server.listen(8080, function(){
  console.log('listening on port: 8080');
});