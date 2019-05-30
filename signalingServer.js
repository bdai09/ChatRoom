const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocketServer = require('ws').Server;

const cfg = {
    ssl: true,
    port: 18080,
    ssl_key: './server.key',
    ssl_cert: './server.crt'
};

const mimeTypes = {
    '.js' : 'text/javascript',
    '.html': 'text/html',
    '.css' : 'text/css'
};

let connectionArray = [];
// store the mapping between connection and ID
const connIDMap = {};
// store the mapping between connection and username
const connUserMap = {};
let nextID = Date.now();
let appendToMakeUnique = 1;

const processRequest = (req, res) => {
    const lookup = path.basename(decodeURI(req.url)) ||
        'index.html';
    const f = __dirname + '\\src\\' + lookup;
    console.log(f);
    fs.exists(f, function (exists) {
        if (exists) {
            fs.readFile(f, function (err, data) {
                if (err) {
                    res.writeHead(500);
                    res.end('Server Error!');
                    return;
                }
                const headers = {
                    'Content-type': mimeTypes[path.extname
                    (lookup)]
                };
                res.writeHead(200, headers);
                res.end(data);
            });
            return;
        }
        res.writeHead(404);
        res.end('Page Not Found');
    });
};

const httpsServer = https.createServer({
    key: fs.readFileSync(cfg.ssl_key),
    cert: fs.readFileSync(cfg.ssl_cert)
}, processRequest).listen(cfg.port);

const wss = new WebSocketServer({server: httpsServer});

wss.on('connection', conn => {
    console.log('new connection');
    connectionArray.push(conn);
    conn.clientID = nextID++;
    connIDMap[conn.clientID] = conn;
    let msg = {
        type: "id",
        id: conn.clientID
    };
    conn.send(JSON.stringify(msg));
    conn.on('message', message => {
        console.log('message is called: ' + message);

        let sendToClients = true;
        msg = JSON.parse(message);
        const connect = getConnectionByID(msg.id);
        console.log('msg type is ' + msg.type);
        switch (msg.type) {
            case "message":
                msg.name = connect.username;
                msg.text = msg.text.replace(/(<([^>]+)>)/ig, "");
                break;
            case "username":
                let nameChanged = false;
                const origName = msg.name;
                while (!isUsernameUnique(msg.name)) {
                    msg.name = origName + appendToMakeUnique;
                    appendToMakeUnique++;
                    nameChanged = true;
                }
                if (nameChanged) {
                    const changeMsg = {
                        id: msg.id,
                        type: "rejectusername",
                        name: msg.name
                    };
                    connect.send(JSON.stringify(changeMsg));
                }
                connect.username = msg.name;
                connUserMap[connect.username] = connect;
                sendUserListToAll();
                sendToClients = false;
                break;
        }
        if (sendToClients) {
            const msgString = JSON.stringify(msg);
            if (msg.target && msg.target !== undefined && msg.target.length !== 0) {
                sendToOneUser(msg.target, msgString);
            } else {
                for (const conn of connectionArray) {
                    conn.send(msgString);
                }
            }
        }
    });
    conn.on('close', (reason, description) => {
        connectionArray = connectionArray.filter(conn => conn.connected);
        sendUserListToAll();
        let logMessage = "Connection closed: " + conn.remoteAddress + " (" +
            reason;
        if (description !== null && description.length !== 0) {
            logMessage += ": " + description;
        }
        logMessage += ")";
        log(logMessage);
    });
});

const log = text => {
    const time = new Date();
    console.log("[" + time.toLocaleTimeString() + "] " + text);
};

const isUsernameUnique = name => !connUserMap[name];

const getConnectionByID = id => {
    let connect = null;
    for (const conn of connectionArray) {
        if (conn.clientID === id) {
            connect = conn;
            break;
        }
    }
    return connect;
};

const sendToOneUser = (target, msgString) => {
    for(const conn of connectionArray){
        if(conn.username === target){
            console.log('send to user name: ', conn.username);
            console.log('the mssage string is: ', msgString);
            conn.send(msgString);
            break;
        }
    }
};

const makeUserListMessage = () => {
    const userListMsg = {
        type: "userlist",
        users: []
    };
    connectionArray.forEach(conn => userListMsg.users.push(conn.username));
    return userListMsg;
};

const sendUserListToAll = () => {
    const userListMsg = makeUserListMessage();
    const userListMsgStr = JSON.stringify(userListMsg);
    connectionArray.forEach(conn => conn.send(userListMsgStr));
};