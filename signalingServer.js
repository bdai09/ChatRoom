const https=require('https');
const fs=require('fs');
const path=require('path');
const WebSocketServer=require('ws').Server;


const cfg={
    ssl:true,
    port:18080,
    ssl_key: './server.key',
    ssl_cert:'./server.crt'
};
 //TYPES supported by mediarecorder
const mimeTypes={
    '.js':'text/javascript',
    '.html':'text/html',
    '.css':'text/css',
}
let connectionArray=[];
//store the mapping relationship between connection and ID
const connIDMap={};
//store the mapping relationship between connection and username
const connUserMap={};

let nextID=Date.now();
let appendToMakeUnique=1;

const processRequest=(req,res)=>{
    const lookup=path.basename(decodeURI(req.url))||'chatroom.html';
    const f=__dirname+'\\content\\'+lookup;
    console.log(f);
    fs.exists(f,function(exists){
        if(exists){
            fs.readFile(f,function(err,data){
                if(err){
                    res.writeHead(500);
                    res.end('Server Error!');
                    return;
                }
                const headers={
                    'Content-type':mimeTypes[path.extname(lookup)]
                };
                res.writeHead(200,headers);
                res.end(data);
            });
            return;
        }
        res.writeHead(404);
        res.end('Page Not Found');
    });
};

const httpsServer=https.createServer({
    key:fs.readFileSync(cfg.ssl_key),
    cert:fs.readFileSync(cfg.ssl_cert)
}, processRequest).listen(cfg.port);


const wss=