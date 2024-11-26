const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios'); // For making HTTP requests to other nodes
const { Blockchain, encryptMessage, decryptMessage } = require('./blockchain');
const port = process.argv[2]; // Dynamic port configuration

// Create an instance of Blockchain
const myBlockchain = new Blockchain();

// Constructor function for Block
function Block(index, timestamp, message, previousHash = '') {
    this.index = index;  // Index of the block in the chain
    this.timestamp = timestamp;  // Timestamp when the block was created
    this.message = message;  // Data/message stored in the block
    this.previousHash = previousHash;  // Hash of the previous block in the chain
    this.hash = this.calculateHash();  // Hash of the current block
    this.nonce = 0;  // Nonce value used for Proof of Work
}

// Prototype method to calculate the hash of the block using SHA-256
Block.prototype.calculateHash = function() {
    return crypto.createHash('sha256').update(this.index + this.timestamp + JSON.stringify(this.message) + this.previousHash + this.nonce).digest('hex');
};

// Prototype method to perform Proof of Work by finding a hash that satisfies the difficulty level
Block.prototype.mineBlock = function(difficulty) {
    // Repeat until the block hash starts with a certain number of zeros (difficulty level)
    while (this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")) {
        this.nonce++;  // Increment nonce to find a valid hash
        this.hash = this.calculateHash();  // Recalculate hash with the new nonce value
    }
    console.log("Block mined: " + this.hash);  // Output the mined block's hash
};

// Setup Express app for network node
const app = express();
app.use(bodyParser.json());  // Use body-parser to parse JSON bodies into JS objects

// Route to get the entire blockchain
app.get('/blockchain', (req, res) => {
    res.send(myBlockchain);  // Send the entire blockchain as a response
});

// Route to add a new block to the blockchain
app.post('/addBlock', (req, res) => {
    const newBlock = new Block(myBlockchain.chain.length, Date.now(), req.body.message);  // Create a new block with the provided message
    myBlockchain.addBlock(newBlock);  // Add the new block to the blockchain
    res.send(newBlock);  // Return the newly added block as a response
});

// Route to send a message
app.post('/sendMessage', (req, res) => {
    const { message, secret } = req.body;
    const encryptedMessage = encryptMessage(message, secret);
    myBlockchain.createNewBlock(encryptedMessage);
    res.send({ message: 'Message sent and added to blockchain', encryptedMessage });
});

// Route to receive the latest message
app.get('/receiveMessage', (req, res) => {
    const { secret } = req.query;
    try {
        const latestBlock = myBlockchain.getLatestBlock();
        const decryptedMessage = decryptMessage(latestBlock.message, secret);
        res.send({ message: 'Message received', decryptedMessage });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// Route to send a direct message
app.post('/sendDirectMessage', async (req, res) => {
    const { message, secret, recipient } = req.body;
    const encryptedMessage = encryptMessage(message, secret);
    myBlockchain.createNewBlock(encryptedMessage, recipient);
    res.send({ message: 'Direct message sent and added to blockchain', encryptedMessage });
});

// Route to receive the latest direct message
app.get('/receiveDirectMessage', (req, res) => {
    const { secret, recipient } = req.query;
    try {
        const latestBlock = myBlockchain.getLatestBlock();
        if (latestBlock.recipient === recipient) {
            const decryptedMessage = decryptMessage(latestBlock.message, secret);
            res.send({ message: 'Direct message received', decryptedMessage });
        } else {
            res.status(403).send({ error: 'You are not the intended recipient of this message.' });
        }
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// Route to register a new node and broadcast it to the network
app.post('/registerNodeAndBroadcast', async (req, res) => {
    const newNodeAddress = req.body.address;  // Get the new node's address from the request body
    myBlockchain.registerNode(newNodeAddress);  // Register the new node

    // Broadcast the new node to all other nodes in the network
    const regNodesPromises = [];
    myBlockchain.networkNodes.forEach(node => {
        regNodesPromises.push(axios.post(`${node}/registerNode`, { address: newNodeAddress }));
    });

    try {
        await Promise.all(regNodesPromises);
        res.send({ message: 'New node registered and broadcasted successfully', nodeAddress: newNodeAddress });
    } catch (error) {
        console.error('Error broadcasting new node:', error);
        res.status(500).send({ error: 'Error broadcasting new node' });
    }
});

// Route to register a new node
app.post('/registerNode', (req, res) => {
    const newNodeAddress = req.body.address;
    myBlockchain.registerNode(newNodeAddress);
    res.send({ message: 'New node registered successfully', nodeAddress: newNodeAddress });
});

// Route to register multiple nodes
app.post('/registerNodes', (req, res) => {
    const newNodeAddresses = req.body.addresses;  // Get the list of new node addresses from the request body
    myBlockchain.registerNodes(newNodeAddresses);  // Register the new nodes
    res.send({ message: 'New nodes registered successfully', nodeAddresses: newNodeAddresses });  // Return a success message and the new nodes' addresses
});



// Route to check if the blockchain is valid
app.get('/isValid', (req, res) => {
    res.send({ isValid: myBlockchain.isChainValid() });  // Return validation status of the blockchain
});

// Route to achieve consensus
app.get('/consensus', async (req, res) => {
    const result = await myBlockchain.consensus();
    res.json(result);
});

// Start the server on the specified port
app.listen(port, () => {
    if (myBlockchain.isChainValid()) {
        console.log(`Server is running on port ${port}`);
    } else {
        console.error('Blockchain is invalid. Shutting down the server.');
        process.exit(1);
    }
});