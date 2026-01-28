const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        title: "Antigravity Switch",
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true
    });

    // Wait a moment for server to start, then load
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3847');
    }, 1000);

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

function startServer() {
    // Run server.js as a separate process to avoid main thread blocking/context issues
    serverProcess = fork(path.join(__dirname, 'server.js'), [], {
        silent: true,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });

    serverProcess.on('error', (err) => {
        console.error('Server failed to start:', err);
    });
}

app.on('ready', () => {
    startServer();
    createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
