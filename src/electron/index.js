/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */


const fs = require('fs');
const nodeFetch = require("node-fetch");
const https = require("https");
const http = require("http");
const dns = require("dns");
const upNode18= process.versions.node.split('.').map(Number)[0] >18;
const {BrowserWindow,session} = require('electron');

let mainWindow = BrowserWindow.getAllWindows()[0]

const closeMainWindow = async (e)=>{
  mainWindow=undefined;
};
mainWindow.once("close" ,closeMainWindow)

const downloadFile = (async (url, path,headers,progressCallback) => {
  const res = await nodeFetch(url,{ method: 'GET', headers: headers,agent:(url)=>{

      const options={
        lookup : async (hostname,options,callback)=>{
          const e= await  session.defaultSession.resolveHost(hostname);
          if(upNode18){
            callback(null,[{address:e.endpoints[0].address,family:e.endpoints[0].family==="ipv6"?6:4}]);
          }
          else{
            callback(null,e.endpoints[0].address,e.endpoints[0].family==="ipv6"?6:4 );
          }

          // if (typeof options === "object")
          //   options.all = true;
          // else
          //   options={family:undefined,hints:0,all:true};
          // dns.lookup(hostname,options,(err,resAdd)=>{
          //   if (err)
          //     return callback(err, undefined,undefined);
          //   const firstIPv6= resAdd.find((res)=>res.family == 6);
          //   if (firstIPv6)
          //     return callback(null, firstIPv6.address, firstIPv6.family)
          //   callback(null, resAdd[0].address, resAdd[0].family)
          // })
          
        }
      }
      if ( url.protocol ==="https:"){
        return new https.Agent(options)
      }else if ( url.protocol ==="http:"){
        return new http.Agent(options)
      }

  }});


  if (res.status ==404)
    throw {error:true,code:1,source:url, target:path, http_status:res.status,exception:res.statusText, response:await res.text() };
  if (res.status  ===304){
    throw { error:true,code:5,source:url, target:path, http_status:res.status,exception:res.statusText , response:await res.text()} ;
  }
  if (!(res.status  >=200 && res.status  <= 299)){
    throw { error:true,code:3,source:url, target:path, http_status:res.status,exception:res.statusText , response:await res.text()} ;
  }
const bytes = res.headers.get('content-length') || res.headers.get('Content-Length') || 0

const fileStream = fs.createWriteStream(path);
return new Promise((resolve, reject) => {
     let downloaded = 0; 
     
     fileStream.on("finish", (a)=>{
      ///if(!fileStream.closed) fileStream.close(); 
      resolve(a);
      
       
    });
      

     fileStream.on("error",(e)=>{reject({ error:true,code:0,source:url, target:path, http_status:0,exception:"Fehler beim Schreiben in eine Datei oder eine reservierte Datei." , response:e.message})});
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      let boolSendJsFeedbackEvery250ms=false
      res.body.on('data', (chunk) => {downloaded+=chunk.length;
        if(boolSendJsFeedbackEvery250ms)
          return;
        boolSendJsFeedbackEvery250ms=true;
        setTimeout(()=>{boolSendJsFeedbackEvery250ms=false;},250)
          mainWindow?.webContents?.executeJavaScript(`if(window.${progressCallback})${progressCallback}({loaded:${downloaded},total:${bytes},lengthComputable:true})`).catch((e)=>{
            // console.error("mainWindow.webContents.executeJavaScript[FileDownload]")
            // console.error(e)
          })
      } );
    });
});


module.exports = {

    download:function ([[source, target, trustAllHosts, id, headers,progressCallback]]) {
    return download(source, target, trustAllHosts, id, headers,progressCallback);
  }

};
async function download(source, target, trustAllHosts, id, headers,progressCallback) {
  try {
    if(!headers)
      headers={};
    const Cookie= (await session.defaultSession.cookies.get({url:source})).map((cookie)=>{return `${cookie.name}=${cookie.value}; `}).reduce((accumulator, currentValue) => accumulator + currentValue, "");
    if(Cookie)
      headers.Cookie=Cookie;
    const res= await downloadFile(source,target,headers,progressCallback)
    return {
      isDirectory:false,
      isFile:true,
      fullPath:target,
      name:target
    }
    
  } catch (error) {
    debugger
    if ( error?.error)
      return error;
    if(error?.code === "ECONNREFUSED"|| error?.code === "ECONNRESET"){
        return {error:true,code:3,source:source, target:target, http_status:0 , exception: error.code , response: error?.message };
    }
    
    throw error;
  }

}
