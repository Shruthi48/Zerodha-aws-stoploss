require('dotenv').config();
var KiteConnect = require("kiteconnect").KiteConnect;
var kc = new KiteConnect({
    api_key: process.env.API_KEY,
    access_token: process.env.ACCESS_TOKEN
  });

function getAccessToken() {
  kc.generateSession(process.env.REQUEST_TOKEN, process.env.API_SECRET)
  .then(function (response) {
      console.log('acc', response);
  })
  .catch(function (err) {
    console.log(err);
  });
}

 
getAccessToken();

