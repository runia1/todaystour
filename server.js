/**
 * Created by mar on 12/22/16.
 */

'use strict';

let express = require('express');

//DEFINE THE APP
let app = express();

//DEFINE THE API ENDPOINTS THAT ARE ACCESSIBLE
app.use('/api/v1', require('./my_modules/api-v1')());

//DEFINE ALL STATIC ROUTES
app.use(express.static(__dirname + '/sites/user/build/bundled'));

//ROUTES NOT YET HANDLED GET FORWARDED TO INDEX
app.use('*', express.static(__dirname + '/sites/user/build/bundled/index.html'));

require('letsencrypt-express').create({
  server: 'https://acme-v01.api.letsencrypt.org/directory',
  email: 'runiam@sou.edu',
  agreeTos: true,
  approveDomains: ['todaystour.com', 'www.todaystour.com'],
  app: app
}).listen(80, 443);