const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const axios = require('axios');
const { rimraf } = require('rimraf');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;
let scriptProcess = null; // This will hold the spawned 'start.sh' process
let activeServerDir = null; // This will hold the directory of the running server
const minecraftVersionsUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
const playitExecutableName = 'playit-linux-amd64';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- Utility Functions ---
async function getMinecraftVersions() {
    try {
        const response = await axios.get(minecraftVersionsUrl);
        return response.data.versions.filter(v => v.type === 'release').slice(0, 50);
    } catch (error) {
        console.error('Error fetching Minecraft versions:', error);
        return [];
    }
}

async function getExistingServers() {
    try {
        const entries = await fsp.readdir(__dirname, { withFileTypes: true });
        return entries
            .filter(dirent => dirent.isDirectory() && !['node_modules', 'public', '.git', '.idx'].includes(dirent.name) && !dirent.name.startsWith('.'))
            .map(dirent => dirent.name);
    } catch (error) {
        console.error("Error reading server directories:", error);
        return [];
    }
}

async function sendInitialData(socket) {
    try {
        const [versions, servers] = await Promise.all([getMinecraftVersions(), getExistingServers()]);
        socket.emit('minecraft-versions', versions);
        socket.emit('existing-servers', servers);
    } catch (error) {
        console.error("Error sending initial data:", error);
    }
}

// --- Process Management ---
const stopServerProcess = (callback) => {
    if (!scriptProcess) {
        console.log('[DIAGNOSTIC] No server process to stop.');
        if (callback) callback();
        return;
    }

    console.log('[DIAGNOSTIC] Attempting to stop server process...');
    io.emit('terminal-output', `\n--- Parando o servidor... ---\n`);
    
    // Kill the spawned script process
    scriptProcess.kill('SIGKILL');

    // Fallback cleanup for orphaned processes
    const cleanupCommand = `pkill -f 'java -Xmx'; pkill -f ${playitExecutableName}`;
    exec(cleanupCommand, (err, stdout, stderr) => {
        if (err && !err.message.includes('No such process')) {
            console.error('[DIAGNOSTIC] Error during pkill cleanup:', stderr);
        } else {
            console.log('[DIAGNOSTIC] Cleanup pkill command executed.');
        }

        console.log('Server processes stopped.');
        scriptProcess = null;
        activeServerDir = null;
        io.emit('script-stopped');
        if (callback) callback();
    });
};

const startScriptProcess = (socket, serverDir) => {
    const fullServerDir = path.join(__dirname, serverDir);
    const scriptPath = path.join(fullServerDir, 'start.sh');

    if (!fs.existsSync(scriptPath)) {
        io.emit('terminal-output', `\n--- ERRO: O script 'start.sh' não foi encontrado em '${serverDir}'. ---\n`);
        return;
    }
    
    console.log(`[DIAGNOSTIC] Starting script: ${scriptPath} in ${fullServerDir}`);
    
    activeServerDir = serverDir;
    scriptProcess = spawn('bash', [scriptPath], { cwd: fullServerDir, stdio: 'pipe' });
    
    io.emit('script-started', serverDir);

    scriptProcess.on('error', (err) => {
        console.error('[DIAGNOSTIC] FAILED TO START PROCESS:', err);
        io.emit('terminal-output', `\n--- CRITICAL ERROR: Could not start the server process. ---\n`);
        activeServerDir = null;
        scriptProcess = null;
    });

    scriptProcess.stdout.on('data', (data) => io.emit('terminal-output', data.toString()));
    scriptProcess.stderr.on('data', (data) => io.emit('terminal-output', `STDERR: ${data.toString()}`));

    scriptProcess.on('close', (code) => {
        console.log(`[DIAGNOSTIC] Process exited with code: ${code}`);
        io.emit('script-stopped');
        io.emit('terminal-output', `\n--- Processo do servidor finalizado (código: ${code}) ---\n`);
        activeServerDir = null;
        scriptProcess = null;
    });
};


// --- API Endpoints ---
app.delete('/delete/:serverName', async (req, res) => {
    const { serverName } = req.params;
    const serverPath = path.join(__dirname, serverName);
    if (!serverName || serverName.includes('..') || serverName.includes('/')) {
        return res.status(400).json({ success: false, message: 'Nome de servidor inválido.' });
    }
    try {
        await rimraf(serverPath);
        io.emit('existing-servers', await getExistingServers());
        res.json({ success: true, message: `Servidor '${serverName}' deletado.` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao deletar a pasta do servidor.' });
    }
});

// --- Socket.IO Handlers ---
io.on('connection', (socket) => {
    console.log('Client connected');
    sendInitialData(socket);

    socket.on('get-initial-data', () => sendInitialData(socket));

    socket.on('create-server', async ({ versionName, serverName }) => {
        const serverDir = path.join(__dirname, serverName);
        try {
            socket.emit('creation-status', `Criando diretório: ${serverName}`);
            await fsp.mkdir(serverDir, { recursive: true });

            const versions = await getMinecraftVersions();
            const versionMeta = versions.find(v => v.id === versionName);
            if (!versionMeta) throw new Error(`URL da versão para ${versionName} não encontrada.`);
            
            const metaResponse = await axios.get(versionMeta.url);
            const downloadUrl = metaResponse.data.downloads.server.url;
            if (!downloadUrl) throw new Error('URL de download do servidor não encontrada.');

            socket.emit('creation-status', `Baixando server.jar (versão ${versionName})...`);
            const jarResponse = await axios({ url: downloadUrl, responseType: 'stream' });
            const writer = fs.createWriteStream(path.join(serverDir, 'server.jar'));
            jarResponse.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            socket.emit('creation-status', 'Download completo. Aceitando EULA...');
            await fsp.writeFile(path.join(serverDir, 'eula.txt'), 'eula=true');

            socket.emit('creation-status', 'Copiando arquivos de inicialização...');
            const filesToCopy = ['start.sh', playitExecutableName];

            for (const file of filesToCopy) {
                const src = path.join(__dirname, file);
                const dest = path.join(serverDir, file);
                try {
                    await fsp.copyFile(src, dest);
                    await fsp.chmod(dest, '755');
                } catch (copyError) {
                     throw new Error(`Falha ao copiar o arquivo essencial '${file}'. Certifique-se que ele existe no diretório principal.`);
                }
            }

            socket.emit('creation-status', `\nServidor '${serverName}' criado com sucesso!`);
            io.emit('existing-servers', await getExistingServers());

        } catch (error) {
            console.error('[CREATE-SERVER] FATAL ERROR:', error);
            socket.emit('creation-status', `\nERRO: ${error.message}`);
            try { await rimraf(serverDir); } catch (e) { console.error('Cleanup failed:', e); }
        }
    });
    
    socket.on('start-script', ({ serverDir }) => {
        if (scriptProcess) {
            socket.emit('terminal-output', `\n--- Um servidor já está em execução. Pare-o primeiro. ---\n`);
            return;
        }
        if (!serverDir) {
            socket.emit('terminal-output', `\n--- Por favor, selecione um servidor. ---\n`);
            return;
        }
        startScriptProcess(socket, serverDir);
    });

    socket.on('stop-script', () => {
        if (!scriptProcess) {
             socket.emit('terminal-output', `\n--- Nenhum servidor em execução para parar. ---\n`);
             return;
        }
        stopServerProcess();
    });
    
    socket.on('restart-script', () => {
        if (!scriptProcess || !activeServerDir) {
            socket.emit('terminal-output', `\n--- Nenhum servidor em execução para reiniciar. ---\n`);
            return;
        }
        const serverToRestart = activeServerDir;
        io.emit('terminal-output', `\n--- Reiniciando o servidor '${serverToRestart}'... ---\n`);
        stopServerProcess(() => {
            // Short delay to ensure all resources are freed before restarting.
            setTimeout(() => {
                startScriptProcess(socket, serverToRestart);
            }, 1500);
        });
    });
    
    socket.on('terminal-command', (command) => {
        if (scriptProcess && scriptProcess.stdin) {
            scriptProcess.stdin.write(command + "\n");
        } else {
            socket.emit('terminal-output', `\n--- Nenhum servidor em execução para enviar o comando. ---\n`);
        }
    });

    socket.on('disconnect', () => console.log('Client disconnected'));
});

// --- Server Initialization ---
server.listen(PORT, () => {
  console.log(`Painel de controle iniciado em http://localhost:${PORT}`);
});
