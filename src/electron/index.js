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
const {BrowserWindow,session} = require('electron');
const mainWindow = BrowserWindow.getAllWindows()[0]
const downloadFile = (async (url, path,headers,progressCallback) => {
  const res = await nodeFetch(url,{ method: 'GET', headers: headers});
  if (res.status ==404)
  throw {error:true,code:1,source:url, target:path, http_status:res.status,exception:res.statusText, response:await res.text() };
  if (!(res.status  >=200 && res.status  <= 299)){
    throw { error:true,code:3,source:url, target:path, http_status:res.status,exception:res.statusText , response:await res.text()} ;
  }
  if (res.status  ===304){
    throw { error:true,code:5,source:url, target:path, http_status:res.status,exception:res.statusText , response:await res.text()} ;
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
