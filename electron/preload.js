/**
 * MacAmp Electron Preload Script
 * Seamless IPC Bridge for Windows (.exe), Linux, and Electron desktop hosts.
 * Developed by ToolNPlay.com • Authors: Pardeep Kumar & Harsh Suman
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (action, payload = {}) => {
    ipcRenderer.send('macamp-action', { action, ...payload });
  },
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  }
});

// Provide backward-compatible WebKit postMessage interface for seamless compatibility
contextBridge.exposeInMainWorld('webkit', {
  messageHandlers: {
    macamp: {
      postMessage: (data) => {
        ipcRenderer.send('macamp-action', data);
      }
    }
  }
});

// Listen for native events dispatched from main process to window
ipcRenderer.on('native-add-track', (event, track) => {
  if (window.macAmp && window.macAmp.addTrackFromNative) {
    window.macAmp.addTrackFromNative(track.title, track.artist, track.url, track.format);
  }
});

ipcRenderer.on('native-add-tracks-batch', (event, tracksJson) => {
  if (window.macAmp && window.macAmp.addTracksBatchFromNative) {
    window.macAmp.addTracksBatchFromNative(tracksJson);
  }
});

ipcRenderer.on('native-load-collection', (event, collectionJson) => {
  if (window.macAmp && window.macAmp.loadCollectionFromNative) {
    window.macAmp.loadCollectionFromNative(collectionJson);
  }
});
