import * as  bodyParser from 'body-parser';
import * as express from 'express';
import * as _ from 'lodash';
import {
    Block, generateNextBlock, generatenextBlockWithTransaction, generateRawNextBlock, getWalletBalance,getAccountBalance, genOneWallet,
    getBlockchain, getMyUnspentTransactionOutputs, getUnspentTxOuts, sendTransaction, sendVoipTransaction
} from './blockchain';
import {connectToPeers, getSockets, initP2PServer} from './p2p';
import {UnspentTxOut} from './transaction';
import {getTransactionPool} from './transactionPool';
import {getPublicFromWallet, initWallet} from './wallet';

const httpPort: number = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort: number = parseInt(process.env.P2P_PORT) || 6001;

const initHttpServer = (myHttpPort: number) => {
    const app = express();
    app.use(bodyParser.json());

    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });

    app.get('/blocks', (req, res) => {
        res.send(getBlockchain());
    });

    app.get('/block/:hash', (req, res) => {
        const block = _.find(getBlockchain(), {'hash' : req.params.hash});
        res.send(block);
    });

    app.get('/transaction/:id', (req, res) => {
        const tx = _(getBlockchain())
            .map((blocks) => blocks.data)
            .flatten()
            .find({'id': req.params.id});
        res.send(tx);
    });

    app.get('/address/:address', (req, res) => {
        const unspentTxOuts: UnspentTxOut[] =
            _.filter(getUnspentTxOuts(), (uTxO) => uTxO.address === req.params.address);
        res.send({'unspentTxOuts': unspentTxOuts});
    });

    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send(getUnspentTxOuts());
    });

    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send(getMyUnspentTransactionOutputs());
    });

    app.post('/mineRawBlock', (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock: Block = generateRawNextBlock(req.body.data);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.post('/mineBlock', (req, res) => {
        const newBlock: Block = generateNextBlock();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.get('/balance', (req, res) => {
        const balance: number = getAccountBalance();
        res.send({'balance': balance});
    });

    app.get('/wallet_balance/:address', (req, res) => {
        const address = req.params.address;
        const balance: number = getWalletBalance(address);
        res.send({'balance': balance,'address':address});
    });

    app.get('/gen_wallet', (req, res) => {
        const new_wallet = genOneWallet();
        res.send({ 'new_wallet': new_wallet });
    });

    app.get('/address', (req, res) => {
        const address: string = getPublicFromWallet();
        res.send({'address': address});
    });

    app.post('/mineTransaction', (req, res) => {
        const address = req.body.address;
        const amount = req.body.amount;
        try {
            const resp = generatenextBlockWithTransaction(address, amount);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });


    app.post('/sendTransaction', (req, res) => {
        try {
            const address = req.body.address;
            const from_address = req.body.from_address;
            const amount = req.body.amount;
            const txType = req.body.txType;
            const status = req.body.status;
            const from_phone = req.body.from_phone;
            const to_phone = req.body.to_phone;

            if (address === undefined  || address === "" || amount === undefined || amount === 0) {
                throw Error('invalid address or amount');
            }
            
            if(txType == 'Voip'){
             const resp = sendVoipTransaction(address, amount, status, from_phone, to_phone, from_address);
             res.send(resp);
            }elseif(txType == 'Wallet'){
             const resp = sendWalletTransaction(address, private_key, to_address, amount);
             res.send(resp);
            }else{
             const resp = sendTransaction(address, amount);
             res.send(resp);
            }  
            
        }catch(e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    app.get('/transactionPool', (req, res) => {
        res.send(getTransactionPool());
    });

    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', (req, res) => {
        connectToPeers(req.body.peer);
        res.send();
    });

    app.post('/stop', (req, res) => {
        res.send({'msg' : 'stopping server'});
        process.exit();
    });

    app.listen(myHttpPort, () => {
        console.log('Listening http on port: ' + myHttpPort);
    });
};

initHttpServer(httpPort);
initP2PServer(p2pPort);
initWallet();
