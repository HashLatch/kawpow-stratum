var http = require('http');

var myCoin = {
    "name": "HashLatch",
    "symbol": "HLC",
    "algorithm": "kawpow",
    "peerMagic": "50574858",
    "peerMagicTestnet": "50574858"
};

function waitForNode(callback) {
    var body = JSON.stringify({jsonrpc:"1.0",id:"check",method:"getblockcount",params:[]});
    var options = {
        hostname:"127.0.0.1", port:8766, path:"/", method:"POST",
        auth:"hashlatch:test123",
        headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}
    };
    var req = http.request(options, function(res) {
        var data = "";
        res.on("data", function(d){ data += d; });
        res.on("end", function(){
            try {
                var r = JSON.parse(data);
                if (r.result !== null && r.result !== undefined) {
                    console.log("[node] Ready at block " + r.result);
                    callback();
                    return;
                }
            } catch(e) {}
            console.log("[node] Not ready, retry in 5s...");
            setTimeout(function(){ waitForNode(callback); }, 5000);
        });
    });
    req.on("error", function(){
        console.log("[node] RPC not available, retry in 5s...");
        setTimeout(function(){ waitForNode(callback); }, 5000);
    });
    req.write(body);
    req.end();
}

function startStratum() {
    var Stratum = require("./lib/index.js");
    var pool = Stratum.createPool({
        "coin": myCoin,
        "address": "co8z5Qfgdo86XyEFeS2DnQEsUxQcKjnTFG",
        "rewardRecipients": {"cRYRACPgomBGC198N31GTbaHqp85bQV5b3": 2},
        "kawpow_validator": "kawpowd",
        "kawpow_wrapper_host": "127.0.0.1",
        "kawpow_wrapper_port": 9999,
        "blockRefreshInterval": 5000,
        "getNewBlockAfterFound": true,
        "jobRebroadcastTimeout": 55,
        "connectionTimeout": 1200,
        "tcpProxyProtocol": false,
        "banning": {"enabled": false},
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
        "daemons": [{"host":"127.0.0.1","port":8766,"user":"hashlatch","password":"test123"}],
        "p2p": {"enabled": false}
    }, function(ip, port, workerName, password, extraNonce1, version, callback) {
        callback({error: null, authorized: true, disconnect: false});
    });

    pool.on("share", function(isValidShare, isValidBlock, data) {
        if (isValidBlock) console.log("BLOCK FOUND! " + JSON.stringify(data));
        else if (isValidShare) console.log("Share accepted from " + data.worker);
        else console.log("Share rejected: " + JSON.stringify(data));
    });

    pool.on("log", function(severity, logKey, logText) {
        console.log("[" + severity + "] [" + logKey + "] " + logText);
    });

    pool.start();
    console.log("HashLatch KawPow Stratum started on port 3052");
}

console.log("[node] Waiting for RPC to be ready...");
waitForNode(startStratum);
