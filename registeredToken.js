require('dotenv').config();
var KiteConnect = require("kiteconnect").KiteConnect;
var kc = new KiteConnect({
    api_key: process.env.API_KEY,
    access_token: process.env.ACCESS_TOKEN
  });

function getRegisteredToken() {
    console.log(kc.getLoginURL());
}

getRegisteredToken();