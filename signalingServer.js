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