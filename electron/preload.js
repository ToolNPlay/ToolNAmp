/**
 * ToolNAmp Electron Preload Script
 * Seamless IPC Bridge for Windows (.exe), Linux, and Electron desktop hosts.
 * Developed by ToolNPlay.com • Authors: Pardeep Kumar & Harsh Suman
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (action, payload = {}) => {
    ipcRenderer.send('toolnamp-action', { action, ...payload });
  },
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  }
});

// Provide backward-compatible WebKit postMessage interface for seamless compatibility
contextBridge.exposeInMainWorld('webkit', {
  messageHandlers: {
    toolnamp: {
      postMessage: (data) => {
        ipcRenderer.send('toolnamp-action', data);
      }
    },
    macamp: {
      postMessage: (data) => {
        ipcRenderer.send('toolnamp-action', data);
      }
    }
  }
});

// Listen for native events dispatched from main process to window
ipcRenderer.on('native-add-track', (event, track) => {
  const app = window.toolNAmp || window.macAmp;
  if (app && app.addTrackFromNative) {
    app.addTrackFromNative(track.title, track.artist, track.url, track.format);
  }
});

ipcRenderer.on('native-add-tracks-batch', (event, tracksJson) => {
  const app = window.toolNAmp || window.macAmp;
  if (app && app.addTracksBatchFromNative) {
    app.addTracksBatchFromNative(tracksJson);
  }
});

ipcRenderer.on('native-load-collection', (event, collectionJson) => {
  const app = window.toolNAmp || window.macAmp;
  if (app && app.loadCollectionFromNative) {
    app.loadCollectionFromNative(collectionJson);
  }
});
