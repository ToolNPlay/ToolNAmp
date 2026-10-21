/**
 * MacAmp Electron Main Process
 * Cross-platform desktop player for Windows (.exe), Linux, and macOS.
 * Developed by ToolNPlay.com • Authors: Pardeep Kumar & Harsh Suman
 */

const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let savedBounds = null;
let isMiniMode = false;

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.aiff', '.webm'];

function getCollectionFilePath() {
  const userDir = app.getPath('userData');
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return path.join(userDir, 'collection.json');
}

function scanFolderForAudio(folderPath, audioFiles = []) {
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      if (entry.isDirectory()) {
        scanFolderForAudio(fullPath, audioFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.includes(ext)) {
          audioFiles.push(fullPath);
        }
      }
    }
  } catch (err) {
    console.error('Error scanning folder:', err);
  }
  return audioFiles;
}

function fileToTrackObject(filePath) {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath);
  const cleanName = path.basename(filePath, ext);
  let artist = 'Local Music';
  let title = cleanName;

  if (cleanName.includes(' - ')) {
    const parts = cleanName.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  // Convert to local streaming URL
  const audioURL = `macamp-audio://local/${filePath.replace(/\\/g, '/')}`;

  return {
    title,
    artist,
    url: audioURL,
    format: ext.replace('.', '').toUpperCase()
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 540,
    minHeight: 420,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0c0e14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png')
  });

  const indexPath = path.join(__dirname, '..', 'src', 'web', 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.webContents.on('did-finish-load', () => {
    // Deliver persisted collection history
    const colPath = getCollectionFilePath();
    if (fs.existsSync(colPath)) {
      try {
        const content = fs.readFileSync(colPath, 'utf8');
        if (content && content.trim().length > 0) {
          mainWindow.webContents.send('native-load-collection', content);
        }
      } catch (e) {
        console.warn('Failed to load collection:', e);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register custom protocol for local audio streaming
app.whenReady().then(() => {
  protocol.registerFileProtocol('macamp-audio', (request, callback) => {
    let raw = request.url.replace(/^macamp-audio:\/\/local\/?/, '');
    raw = decodeURIComponent(raw);
    if (process.platform === 'win32' && !raw.includes(':') && raw.length > 2) {
      // Handle /C:/Users/...
      if (raw.startsWith('/')) raw = raw.substring(1);
    }
    callback({ path: path.normalize(raw) });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Action Handlers
ipcMain.on('macamp-action', async (event, body) => {
  if (!body || !body.action) return;

  const action = body.action;

  switch (action) {
    case 'closeWindow':
      if (mainWindow) mainWindow.close();
      break;

    case 'minimizeWindow':
      if (mainWindow) mainWindow.minimize();
      break;

    case 'zoomWindow':
    case 'maximizeWindow':
      if (mainWindow) {
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
      }
      break;

    case 'setAlwaysOnTop':
      if (mainWindow) {
        mainWindow.setAlwaysOnTop(!!body.value);
      }
      break;

    case 'setMiniMode':
      if (mainWindow) {
        isMiniMode = !!body.mini;
        if (isMiniMode) {
          savedBounds = mainWindow.getBounds();
          mainWindow.setMinimumSize(440, 48);
          mainWindow.setBounds({
            x: savedBounds.x,
            y: savedBounds.y,
            width: 540,
            height: 48
          }, true);
        } else {
          mainWindow.setMinimumSize(540, 420);
          if (savedBounds && savedBounds.height > 100) {
            mainWindow.setBounds(savedBounds, true);
          } else {
            mainWindow.setBounds({
              x: savedBounds ? savedBounds.x : 100,
              y: savedBounds ? savedBounds.y : 100,
              width: 860,
              height: 640
            }, true);
          }
        }
      }
      break;

    case 'openFile': {
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Audio Files for MacAmp',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'aiff', 'webm'] }]
      });

      if (!res.canceled && res.filePaths.length > 0) {
        const tracks = res.filePaths.map(fileToTrackObject);
        mainWindow.webContents.send('native-add-tracks-batch', JSON.stringify(tracks));
      }
      break;
    }

    case 'openFolder': {
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Folder of Music to Import into MacAmp',
        properties: ['openDirectory']
      });

      if (!res.canceled && res.filePaths.length > 0) {
        const folder = res.filePaths[0];
        const audioFiles = scanFolderForAudio(folder);
        if (audioFiles.length > 0) {
          const tracks = audioFiles.map(fileToTrackObject);
          mainWindow.webContents.send('native-add-tracks-batch', JSON.stringify(tracks));
        }
      }
      break;
    }

    case 'saveCollection': {
      if (body.data && typeof body.data === 'string') {
        try {
          const colPath = getCollectionFilePath();
          fs.writeFileSync(colPath, body.data, 'utf8');
        } catch (e) {
          console.warn('Failed to save collection:', e);
        }
      }
      break;
    }

    default:
      break;
  }
});
