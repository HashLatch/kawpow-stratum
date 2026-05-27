var http = require('http');
var myCoin = {
    "name": "HashLatch",
    "symbol": "HLC",
    "algorithm": "kawpow",
    "peerMagic": "50574858",
    "peerMagicTestnet": "50574858"
};

// Wait for node RPC to be ready before starting stratum
function waitForNode(callback) {
    var options = {
        hostname: '127.0.0.1',
        port: 8766,
        path: '/',
        method: 'POST',
        auth: 'hashlatch:test123',
        headers: {'Content-Type': 'application/json'}
    };
    var body = JSON.stringify({jsonrpc:'1.0',method:'getblockcount',params:[]});
    var req = http.request(options, function(res) {
        var data = '';
        res.on('data', function(d) { data += d; });
        res.on('end', function() {
            try {
                var result = JSON.parse(data);
                if (result.result !== null && result.result !== undefined) {
                    console.log('Node ready at block ' + result.result);
                    callback();
                } else {
                    setTimeout(function() { waitForNode(callback); }, 3000);
                }
            } catch(e) {
                setTimeout(function() { waitForNode(callback); }, 3000);
            }
        });
    });
    req.on('error', function() {
        console.log('Waiting for node RPC...');
        setTimeout(function() { waitForNode(callback); }, 3000);
    });
    req.write(body);
    req.end();
}

function startStratum() {
    var Stratum = require('./lib/index.js');
    var pool = Stratum.createPool({
        "coin": myCoin,
        "address": "co8z5Qfgdo86XyEFeS2DnQEsUxQcKjnTFG",
        "rewardRecipients": {"ce6KYfjYGUH5dzxXiBLfGEVArWgLRaLF3V": 2},
        "kawpow_validator": "daemon",
        "blockRefreshInterval": 5000,
        "getNewBlockAfterFound": true,
        "jobRebroadcastTimeout": 55,
        "connectionTimeout": 1200,
        "tcpProxyProtocol": false,
        "banning": {
            "enabled": false
        },
        "ports": {
            "3052": {
                "diff": 0.001,
                "varDiff": {
                    "minDiff": 0.0001,
                    "maxDiff": 1,
                    "targetTime": 15,
                    "retargetTime": 60,
                    "variancePercent": 30
                }
            }
        },
        "daemons": [
            {
                "host": "127.0.0.1",
                "port": 8766,
                "user": "hashlatch",
                "password": "test123"
            }
        ],
        "p2p": {
            "enabled": false
        }
    }, function(ip, port, workerName, password, extraNonce1, version, callback) {
        callback({
            error: null,
            authorized: true,
            disconnect: false
        });
    });

    pool.on('share', function(isValidShare, isValidBlock, data) {
        if (isValidBlock) console.log('BLOCK FOUND! ' + JSON.stringify(data));
        else if (isValidShare) console.log('Share accepted from ' + data.worker);
        else console.log('Share rejected: ' + JSON.stringify(data));
    });

    pool.on('log', function(severity, logKey, logText) {
        console.log('[' + severity + '] [' + logKey + '] ' + logText);
    });

    pool.start();
    console.log('HashLatch KawPow Stratum started on port 3052');
}

console.log('Waiting for node to be ready...');
waitForNode(startStratum);
