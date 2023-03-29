require('dotenv').config();
const https = require('https');
var KiteTicker = require("kiteconnect").KiteTicker;
var KiteConnect = require("kiteconnect").KiteConnect;
const LOSS_LIMIT = -1500;
var kc = new KiteConnect({
    api_key: process.env.API_KEY,
    access_token: process.env.ACCESS_TOKEN
  });

var ticker = new KiteTicker({
	api_key: process.env.API_KEY,
	access_token: process.env.ACCESS_TOKEN
});

let bot = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID
}


function sendMsg(msg) {
  https.get(`https://api.telegram.org/bot${bot.token}/sendMessage?chat_id=${bot.chatId}&text=${msg}`)
}

let instrumentTokens = [];
let myPositions = null;
let tradingSymbols = [];

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
  console.log('placing order', order.tradingsymbol, quantity, delay);
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

const positionsMock = [
  {
    tradingsymbol: 'BANKNIFTY23APR44000CE',
    exchange: 'NFO',
    instrument_token: 13713922,
    product: 'NRML',
    quantity: 0,
    overnight_quantity: -3600,
    multiplier: 1,
    average_price: 0,
    close_price: 4.7,
    last_price: 3.05,
    value: 5225,
    pnl: 5225,
    m2m: 230,
    unrealised: 5225,
    realised: 0,
    buy_quantity: 3600,
    buy_price: 4.636111111111111,
    buy_value: 16690,
    buy_m2m: 16690,
    sell_quantity: 3600,
    sell_price: 6.0875,
    sell_value: 21915,
    sell_m2m: 16920,
    day_buy_quantity: 3600,
    day_buy_price: 4.636111111111111,
    day_buy_value: 16690,
    day_sell_quantity: 0,
    day_sell_price: 0,
    day_sell_value: 0
  },
  {
    tradingsymbol: 'NIFTY2351117100PE',
    exchange: 'NFO',
    instrument_token: 10333698,
    product: 'NRML',
    quantity: 0,
    overnight_quantity: -1800,
    multiplier: 1,
    average_price: 0,
    close_price: 15.15,
    last_price: 13.15,
    value: 8137.500199999999,
    pnl: 8137.500199999999,
    m2m: -1135.0000000000036,
    unrealised: 8137.500199999999,
    realised: 0,
    buy_quantity: 1800,
    buy_price: 15.780555555555557,
    buy_value: 28405.000000000004,
    buy_m2m: 28405.000000000004,
    sell_quantity: 1800,
    sell_price: 20.301389,
    sell_value: 36542.5002,
    sell_m2m: 27270,
    day_buy_quantity: 1800,
    day_buy_price: 15.780555555555557,
    day_buy_value: 28405.000000000004,
    day_sell_quantity: 0,
    day_sell_price: 0,
    day_sell_value: 0
  }
]


ticker.connect();
ticker.on('ticks', onTicks);
ticker.on('connect', subscribe);
ticker.on('disconnect', onDisconnect);
ticker.on('error', onError);
ticker.on('close', onClose);
ticker.on('order_update', onTrade);

let flag = true


async function onTicks(ticks) {
	sendMsg('ticks');
  if(flag) {
    let lastPriceObj = await getLTP(tradingSymbols);
   
    let negativeQuantityPositions = myPositions.filter(position => position.quantity < 0);

    let lossForEachTrade = negativeQuantityPositions.map(item => {
      let value = ((item.average_price - lastPriceObj[`${item.exchange}:${item.tradingsymbol}`].last_price) * item.quantity) * -1;
      console.log('item.tradingsymbol', item.tradingsymbol, item.last_price, item.quantity);
      return value;
    })

    let sumLossForEachTrade = lossForEachTrade.reduce((acc,curr) => acc+curr, 0);
    console.log('sumLossForEachTrade', sumLossForEachTrade);

    if(sumLossForEachTrade <= LOSS_LIMIT) {
      squareOffPositions(negativeQuantityPositions);
      flag = false;
    }
  }
}

const squareOffPositions = (negativeQuantityPositions) => {
  if(negativeQuantityPositions.length > 0) {
    negativeQuantityPositions.forEach(item => {
      breakQuantityAndPlaceOrder(item);
    })
  }
  console.log('squaring off ..', negativeQuantityPositions);
}

async function subscribe () {
  await kc.getPositions().then(response => {
    myPositions = response.net;
    console.log(myPositions);
    instrumentTokens = response.net.map(item => item.quantity < 0 ? item.instrument_token : null);
    tradingSymbols = response.net.map(item => item.quantity < 0 ? `${item.exchange}:${item.tradingsymbol}`: null);
  });

  console.log('instrumentTokens', instrumentTokens);

	var items = instrumentTokens;
	ticker.subscribe(items);
	ticker.setMode(ticker.modeFull, items);
}

function onDisconnect(error) {
	console.log("Closed connection on disconnect", error);
}

function onError(error) {
	console.log("Closed connection on error", error);
}

function onClose(reason) {
	console.log("Closed connection on close", reason);
}

function getLTP(trades) {
  return kc.getLTP(trades).then(response => response);
}

async function onTrade(order) {
  await kc.getPositions().then(response => {
    myPositions = response.net;
    instrumentTokens = response.net.map(item => item.instrument_token);
    tradingSymbols = response.net.map(item => item.quantity < 0 ? `${item.exchange}:${item.tradingsymbol}`: null);

    console.log('updating order by fetching positions');
  });
}