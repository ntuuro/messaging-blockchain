const crypto = require('crypto');  // For hash and encryption functions
const axios = require('axios');  // Import axios for making HTTP requests

// const secret = crypto.randomBytes(32).toString('hex');  // Generate a 256-bit secret key
const secret = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';  // Ensure this is a 32-byte hexadecimal string
// Constructor function for Block
function Block(index, timestamp, message, previousHash = '') {
    this.index = index;  // Index of the block in the chain
    this.timestamp = timestamp;  // Timestamp of block creation
    this.message = message;  // Data/message stored in the block
    this.previousHash = previousHash;  // Hash of the previous block in the chain
    this.hash = this.calculateHash();  // Hash of the current block
    this.nonce = 0;  // Nonce value used for Proof of Work
}

// Prototype method to calculate the hash of the block using SHA-256
Block.prototype.calculateHash = function() {
    return crypto.createHash('sha256').update(this.index + this.timestamp + JSON.stringify(this.message) + this.previousHash + this.nonce).digest('hex');
};

// Prototype method to perform Proof of Work by finding a hash that satisfies a specific difficulty level
Block.prototype.proofOfWork = function(difficulty) {
    // Repeat until the block hash starts with a certain number of zeros (difficulty level)
    while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
        this.nonce++;  // Increment nonce to find a valid hash
        this.hash = this.calculateHash();  // Recalculate hash with the new nonce value
    }
    console.log("Block mined: " + this.hash);
};

// Constructor function for Blockchain
function Blockchain() {
    this.chain = [this.createGenesisBlock()];  // Initialize blockchain with genesis block
    this.difficulty = 4;  // Difficulty level set to 4 for hashes starting with '0000'
    this.addressData = {};  // Object to store address-related data
    this.networkNodes = [];  // Array to store network nodes
    this.currentNodeUrl = process.argv[3];
}

// Method to register a new node
Blockchain.prototype.registerNode = function (nodeUrl) {
    if (this.networkNodes.indexOf(nodeUrl) === -1 && this.currentNodeUrl !== nodeUrl) {
        this.networkNodes.push(nodeUrl);
    }
};

// Method to register multiple nodes
Blockchain.prototype.registerNodes = function (nodeUrls) {
    nodeUrls.forEach(nodeUrl => {
        if (this.networkNodes.indexOf(nodeUrl) === -1 && this.currentNodeUrl !== nodeUrl) {
            this.networkNodes.push(nodeUrl);
        }
    });
};

// Method to achieve consensus
Blockchain.prototype.consensus = async function () {
    const requestPromises = this.networkNodes.map(nodeUrl => {
        return fetch(`${nodeUrl}/blockchain`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        }).then(response => response.json());
    });

    const blockchains = await Promise.all(requestPromises);
    const currentChainLength = this.chain.length;
    let maxChainLength = currentChainLength;
    let newLongestChain = null;
    let newPendingTransactions = null;

    blockchains.forEach(blockchain => {
        if (blockchain.chain.length > maxChainLength) {
            maxChainLength = blockchain.chain.length;
            newLongestChain = blockchain.chain;
            newPendingTransactions = blockchain.pendingTransactions;
        }
    });

    if (!newLongestChain || (newLongestChain && !this.isChainValid(newLongestChain))) {
        return {
            note: 'Current chain has not been replaced.',
            chain: this.chain
        };
    } else {
        this.chain = newLongestChain;
        this.pendingTransactions = newPendingTransactions;
        return {
            note: 'This chain has been replaced.',
            chain: this.chain
        };
    }
};

// Prototype method to create the initial block (genesis block)
Blockchain.prototype.createGenesisBlock = function() {
    return new Block(0, Date.now(), "Genesis Block", "0");
};

// Prototype method to get the latest block on the chain
Blockchain.prototype.getLatestBlock = function() {
    return this.chain[this.chain.length - 1];
};

// Prototype method to add a new block to the blockchain
Blockchain.prototype.addBlock = function(newBlock) {
    newBlock.previousHash = this.getLatestBlock().hash;  // Set previous hash to the hash of the latest block
    newBlock.proofOfWork(this.difficulty);  // Perform proof of work with the set difficulty level
    this.chain.push(newBlock);  // Add the new block to the chain
};

// Prototype method to create a new block and add it to the blockchain
Blockchain.prototype.createNewBlock = function(message) {
    const newBlock = new Block(this.chain.length, Date.now(), message, this.getLatestBlock().hash);  // Create a new block with the given message
    newBlock.proofOfWork(this.difficulty);  // Perform proof of work with the set difficulty level
    this.chain.push(newBlock);  // Add the new block to the chain
    console.log('New block created: ' + newBlock.hash);
};

// Prototype method to check if the blockchain is valid
Blockchain.prototype.isChainValid = function() {
    for (let i = 1; i < this.chain.length; i++) {
        const currentBlock = this.chain[i];
        const previousBlock = this.chain[i - 1];

        // Recreate the block as an instance of the Block class
        const recreatedBlock = new Block(currentBlock.index, currentBlock.timestamp, currentBlock.message, currentBlock.previousHash);
        recreatedBlock.nonce = currentBlock.nonce;
        recreatedBlock.hash = currentBlock.hash;

        // Validate current block's hash
        if (recreatedBlock.hash !== recreatedBlock.calculateHash()) {
            return false;
        }
        // Validate hash link with the previous block
        if (recreatedBlock.previousHash !== previousBlock.hash) {
            return false;
        }
    }
    return true;
}

// Function to update address data
Blockchain.prototype.updateAddressData = function(address, data) {
    if (!this.addressData[address]) {
        this.addressData[address] = [];
    }
    this.addressData[address].push(data);
};

// Function to get address data
Blockchain.prototype.getAddressData = function(address) {
    return this.addressData[address] || [];
};

// Function to encrypt messages using AES-256-CBC
function encryptMessage(message, secret) {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secret, 'hex'), Buffer.alloc(16, 0));
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// Function to decrypt messages using AES-256-CBC
function decryptMessage(encryptedMessage, secret) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secret, 'hex'), Buffer.alloc(16, 0));
    let decrypted = decipher.update(encryptedMessage, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Example usage of the blockchain and encryption
const myBlockchain = new Blockchain();
// const secret = 'mySecretKey';  // Secret key for encryption

// Sender creates a message
const message = "Hello, Blockchain!, what is the secret message?";
const encryptedMessage = encryptMessage(message, secret);


// Add encrypted message to the blockchain
myBlockchain.createNewBlock(encryptedMessage);

// Update address data
myBlockchain.updateAddressData('address1', { balance: 100, transactions: [] });

// Get address data
const addressData = myBlockchain.getAddressData('address1');
console.log("Address Data:", addressData);  // Display address data

// Receiver decrypts the message from the blockchain
const latestBlock = myBlockchain.getLatestBlock();
const decryptedMessage = decryptMessage(latestBlock.message, secret);

// Output results
console.log("Encrypted Message:", latestBlock.message);  // Display encrypted message
console.log("Decrypted Message:", decryptedMessage);  // Display decrypted message
console.log("Is Blockchain Valid?", myBlockchain.isChainValid());  // Validate the blockchain

module.exports = {
    encryptMessage,
    decryptMessage,
    Blockchain
};