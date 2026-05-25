var bitcoin = require('bitcoinjs-lib');
var util = require('./util.js');

// public members
var txHash;

exports.txHash = function(){
  return txHash;
};

function scriptCompile(addrHash){
    script = bitcoin.script.compile(
        [
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,
            addrHash,
            bitcoin.opcodes.OP_EQUALVERIFY,
            bitcoin.opcodes.OP_CHECKSIG
        ]);
    return script;
}

function scriptFoundersCompile(address){
    script = bitcoin.script.compile(
        [
            bitcoin.opcodes.OP_HASH160,
            address,
            bitcoin.opcodes.OP_EQUAL
        ]);
    return script;
}


exports.createGeneration = function(rpcData, blockReward, feeReward, recipients, poolAddress){
    var _this = this;
    var blockPollingIntervalId;

    var emitLog = function (text) {
        _this.emit('log', 'debug', text);
    };
    var emitWarningLog = function (text) {
        _this.emit('log', 'warning', text);
    };
    var emitErrorLog = function (text) {
        _this.emit('log', 'error', text);
    };
    var emitSpecialLog = function (text) {
        _this.emit('log', 'special', text);
    };

    var poolAddrHash = bitcoin.address.fromBase58Check(poolAddress).hash;

    var tx = new bitcoin.Transaction();
    var blockHeight = rpcData.height;
    // BIP34 height encoding matching CScript() << nHeight
    var serializedBlockHeight;
    if (blockHeight >= 1 && blockHeight <= 16) {
        // OP_1 through OP_16 (0x51 - 0x60)
        serializedBlockHeight = new Buffer([0x50 + blockHeight]);
    } else if (blockHeight === 0) {
        serializedBlockHeight = new Buffer([0x00]);
    } else {
        // For height >= 17: push + little-endian bytes
        var heightHex = blockHeight.toString(16);
        if (heightHex.length % 2 !== 0) heightHex = '0' + heightHex;
        var heightBytes = Buffer.from(heightHex, 'hex').reverse();
        // Add sign byte if needed
        if (heightBytes[heightBytes.length-1] & 0x80) {
            heightBytes = Buffer.concat([heightBytes, Buffer.from([0x00])]);
        }
        var pushLen = Buffer.from([heightBytes.length]);
        serializedBlockHeight = Buffer.concat([pushLen, heightBytes]);
    }

    tx.addInput(new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        0xFFFFFFFF,
        0xFFFFFFFF,
        new Buffer.concat([serializedBlockHeight,
            Buffer('6b6177706f77', 'hex')])
    );

    // calculate total fees
    var feePercent = 0;
    for (var i = 0; i < recipients.length; i++) {
        feePercent = feePercent + recipients[i].percent;
    }

    tx.addOutput(
        scriptCompile(poolAddrHash),
        Math.floor(blockReward * (1 - (feePercent / 100)))
    );


    for (var i = 0; i < recipients.length; i++) {
       tx.addOutput(
           scriptCompile(bitcoin.address.fromBase58Check(recipients[i].address).hash),
           Math.round((blockReward) * (recipients[i].percent / 100))
       );
    }


    if (rpcData.default_witness_commitment !== undefined) {
        tx.addOutput(new Buffer(rpcData.default_witness_commitment, 'hex'), 0);
    }

    txHex = tx.toHex();

    // this txHash is used elsewhere. Don't remove it.
    txHash = tx.getHash().toString('hex');

    return txHex;
};

module.exports.getFees = function(feeArray){
    var fee = Number();
    feeArray.forEach(function(value) {
        fee = fee + Number(value.fee);
    });
    return fee;
};
