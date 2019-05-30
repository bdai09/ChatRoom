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
    const lookup=
}
