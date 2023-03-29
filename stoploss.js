require('dotenv').config();
const https = require('https');
const LOSS_LIMIT = process.env.LOSS_LIMIT;
let shouldGetPositions = true;

let bot = {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID
}


function sendMsg(msg) {
    https.get(`https://api.telegram.org/bot${bot.token}/sendMessage?chat_id=${bot.chatId}&text=${msg}`)
 }

var KiteConnect = require("kiteconnect").KiteConnect;
var kc = new KiteConnect({
    api_key: process.env.API_KEY,
    access_token: process.env.ACCESS_TOKEN
  });


const getLossForEachTrade = (data) => {
  return data.map(item => ((item.average_price - item.last_price) * item.quantity)*-1);
}
const getSumLossForEachTrade = (lossForEachTrade) => {
  return lossForEachTrade.reduce((acc,curr) => acc+curr, 0);
}

const checkLossLimit = (sumValue, orders) => {
  sendMsg(`SumValue: ${sumValue}\n LOSS_LIMIT: ${LOSS_LIMIT}`);
  console.log(`SumValue: ${sumValue}\n LOSS_LIMIT: ${LOSS_LIMIT}`);
  if(sumValue <= LOSS_LIMIT) {
      /* square off positions if limit is reached */
    sendMsg('Breached limit!! Squaring off positions');
    console.log('sqaring off positions');
    shouldGetPositions = false;
    squareOffPositions(orders)
      
  }
}

const breakQuantityAndPlaceOrder = (order) => {
  let quantity = Math.abs(order.quantity);
  let maxLimit = 900;

  while( quantity != 0) {
      if(quantity > maxLimit) {
          placeOrderWithDelay(order,900,250);
          quantity = quantity - 900;
        } else {
          placeOrderWithDelay(order,quantity,250);
          quantity = 0;
          setTimeout(() => {
            shouldGetPositions = true;
          })
      }
  }
}

const placeOrderWithDelay = (order, quantity, delay) => {
  setTimeout(() => {
      placeOrder(order, quantity);
  },delay)
}

function placeOrder(order, quantity) {
  kc.placeOrder(order.variety || 'regular', {
       "exchange": order.exchange,
       "tradingsymbol": order.tradingsymbol,
       "transaction_type": 'BUY',
       "quantity": quantity,
       "product": order.product,
       "order_type": "MARKET",
   }).then(function(resp) {
       sendMsg('Order placed successfully');
       console.log('order placed successfully');
   }).catch(e => {
     sendMsg(`Error: Couldnot place order ${e}`)
     console.log('error occured')
   })
}

const squareOffPositions = (orders) => {
  orders.forEach(order => {
   breakQuantityAndPlaceOrder(order)
  })
}


function getPositions() {
  if(shouldGetPositions) {
    console.log('getting positions...');
    sendMsg('Getting positions...');
    kc.getPositions().then(function(response) {
      const maxQuantityNonZero = response.net.length > 0 && response.net.filter(item => item.quantity < 0);
      const lossForEachTrade = getLossForEachTrade(maxQuantityNonZero);
      const sumLossForEachTrade = getSumLossForEachTrade(lossForEachTrade);
      checkLossLimit(sumLossForEachTrade,maxQuantityNonZero);  
	}).catch(function(err) {
    sendMsg(`Get position call failed ${err}`);
		console.log(err);
	})
  } else {
    console.log('stopped getting positions');
    sendMsg('Stopped Getting positions...');
  }
}

function init() {
  setInterval(() => {
    getPositions();
  }, 3000);
}

init();


