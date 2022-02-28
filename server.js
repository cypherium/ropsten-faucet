const CypheriumTx = require('cypheriumjs-tx');
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const fs = require('fs');
const touch = require('touch');
const moment = require('moment');
const querystring = require('querystring');

const config = require('./config.js');

const app = express();
const TX_VERSION = '0x122';
const TX_DEFAULT_GASLIMIT = '0x5708';
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(morgan('combined'));
app.options('/api/eth_sendRawTransaction', cors());

const privateKey = config.privateKey;
const url = 'https://pubnodestest.cypherium.io';
const blacklistTime = 1440; //mins
const recaptchaSecret = config.recaptchaSecret;

// Axios request interceptor
// axios.interceptors.request.use(request => {
//   console.log(request);
//   return request;
// });

// get nonce in future using 'getTransactionCount'
// Generate raw tx
function generateTx(nonce, to) {
  const amount = 5000000000000000000;
  const value = '0x' + parseInt(amount).toString(16);
  const txParams = {
    version: TX_VERSION,
    senderKey: '0x' + privateKey.substring(64, 128),
    nonce: nonce,
    gasLimit: TX_DEFAULT_GASLIMIT,
    gasPrice: '0x430e23400',
    to: to,
    data: 0x00,
    value: value,
    chainId: 12124
  };

  //console.log("Transfer parameters：" + JSON.stringify(txParams));
  const tx = new CypheriumTx.Transaction(txParams, {
  });
  var p = new Uint8Array(hexStringToBytes(privateKey));
  var k = new Uint8Array(hexStringToBytes(privateKey.substring(64, 128)));
  tx.signWith25519(p, k);
  const serializedTx = tx.serialize();
  return serializedTx.toString('hex');
}

// create temporary working director for IP blacklist
function setupBlacklist(path) {
  try {
    fs.mkdir(path, function(err) {});
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  return true
}

// use blacklist to detemine ether eligbility
  // stat the file, if virgin touch the file and release the ether
  // if file exists check modified date
  // < 60 mins reject
  // > 60 mins touch the file and release
function releaseEther(ipPath) {
  try {
    let stats = fs.statSync(ipPath);

    // mtime sample 2017-12-29T14:24:26.472Z
    var mtime = moment(stats['mtime']);
    var now = moment();
    var duration = moment.duration(now.diff(mtime));

    if (duration.asMinutes() > blacklistTime) {
        touch.sync(ipPath);
        return true;
    } else {
        console.log(ipPath + ' - blacklisted')
        return false;
    }
  }
  catch (err) {
      touch.sync(ipPath)
      return true;
  }
}

// Make id same as nonce for simplicity
app.post('/api/eth_sendRawTransaction', cors(), async (req, res) => {
  console.log("post eth_sendRawTransaction body",);
  if (!req.body.address) return res.status(422).send('Empty address field.');

  // get IP address and set up paths
  // let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  // let path = "/tmp/faucet/"
  // let ipPath = path + ip


  // check captcha
/*  let captchaResponse;
  try {
    captchaResponse = await axios({
      method: 'POST',
      url: 'https://www.google.com/recaptcha/api/siteverify',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: querystring.stringify({
        'response': req.body['g-recaptcha-response'],
        'secret': recaptchaSecret
      })
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500);
  }
  console.log("siteverify 1")
  if (!captchaResponse.data.success) return res.status(409).send('Invalid Recaptcha.');
  if (captchaResponse.data.hostname != ip) console.log('Captcha was not solved at host ip');
  console.log("siteverify")*/
  setupBlacklist(req.body.address)
  // release variable below determines whether IP is blacklisted
  let release = releaseEther(req.body.address)
  if (!release) {
    res.status(429).send('Address temporarily blacklisted.');
    return false;
  }
  const to = req.body.address.toLowerCase().replace('0x','');
  let response;
  console.log("req.body.address",req.body.address);
  try {
    response = await axios({
      method: 'POST',
      url: url,
      headers: {
        "Content-Type": "application/json"
      },
      data: {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_getTransactionCount",
        "params": [config.address, "latest"]
      }
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500);
  }
  let txCount = response.data.result;
  console.log("txCount",txCount);
  let done = false;
  while (!done) {
    let rawTx = "0x" + generateTx(txCount, to);
    let params = {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "eth_sendRawTransaction",
      "params": [rawTx]
    };
    try {
      response = await axios({
        method: 'POST',
        url: url,
        headers: {
          "Content-Type": "application/json"
        },
        data: params
      });
      if (typeof response.data.result != "undefined") {
        done = true;
      } else if (response.data.error.message != "undefined") {
        if (response.data.error.message == "nonce too low") txCount++;
      }
    } catch (error) {
      console.log(error.message);
      return res.status(500);
    }
  }

  if (response.status != 200) return res.status(500);

  res.send(response.data.result);
})

app.listen(6000, () => {
  console.log('Ropsten faucet listening on port 6000');
})

function hexStringToBytes(hexStr) {
  let result = [];
  while (hexStr.length >= 2) {
    result.push(parseInt(hexStr.substring(0, 2), 16));
    hexStr = hexStr.substring(2, hexStr.length);
  }
  return result;
}

function bytesToHexString(byteArray) {
  return Array.prototype.map.call(byteArray, function (byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}
