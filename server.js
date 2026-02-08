const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { rimraf } = require('rimraf'); // Importação corrigida

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;
let scriptProcess = null;
const minecraftVersionsUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';

// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- Funções Auxiliares ---

async function getMinecraftVersions() {
    try {
        const response = await axios.get(minecraftVersionsUrl);
        const releases = response.data.versions.filter(v => v.type === 'release').slice(0, 50);
        return releases;
    } catch (error) {
        console.error('Error fetching Minecraft versions:', error);
        return [];
    }
}

async function getExistingServers() {
    try {
        const entries = await fs.readdir(__dirname, { withFileTypes: true });
        const serverDirs = entries
            .filter(dirent => dirent.isDirectory() && dirent.name !== 'node_modules' && !dirent.name.startsWith('.') && dirent.name !== 'public')
            .map(dirent => dirent.name);
        return serverDirs;
    } catch (error) {
        console.error("Error reading server directories:", error);
        return [];
    }
}

async function sendInitialData(socket) {
    const versions = await getMinecraftVersions();
    const servers = await getExistingServers();
    socket.emit('minecraft-versions', versions);
    socket.emit('existing-servers', servers);
}

const stopServerProcess = (callback) => {
    exec("pkill -f 'java -Xmx' && pkill -f 'ngrok tcp'", (err) => {
        if (err) console.error('Error stopping processes:', err.message);
        if (scriptProcess) {
            scriptProcess.kill('SIGINT');
            scriptProcess = null;
        }
        io.emit('script-stopped');
        if (callback) callback();
    });
};

// --- ROTAS DA API ---

app.get('/ip', async (req, res) => {
    try {
        const response = await axios.get('http://127.0.0.1:4040/api/tunnels');
        const tunnels = response.data.tunnels;
        const tcpTunnel = tunnels.find(t => t.proto === 'tcp');

        if (tcpTunnel) {
            const ip = tcpTunnel.public_url.replace('tcp://', '');
            res.json({ ip });
        } else {
            res.status(404).json({ ip: 'Não disponível (túnel não encontrado)' });
        }
    } catch (error) {
        res.status(503).json({ ip: 'Indisponível (verifique se o servidor está online)' });
    }
});

// Rota de delete corrigida
app.delete('/delete/:serverName', async (req, res) => {
    const { serverName } = req.params;
    if (!serverName || serverName.startsWith('.') || serverName === 'node_modules' || serverName === 'public') {
        return res.status(400).json({ success: false, message: 'Nome de servidor inválido.' });
    }

    const serverPath = path.join(__dirname, serverName);
    console.log(`Tentando deletar o servidor: ${serverName}`);

    try {
        // Garante que os processos sejam parados antes de deletar
        await new Promise(resolve => stopServerProcess(resolve));
        console.log(`Processos parados. Deletando a pasta: ${serverPath}`);
        
        // Deleta a pasta do servidor de forma segura com await
        await rimraf(serverPath);
        console.log(`Pasta ${serverPath} deletada.`);

        // Atualiza a lista de servidores para todos os clientes
        const servers = await getExistingServers();
        io.emit('existing-servers', servers);

        res.json({ success: true, message: `Servidor '${serverName}' deletado com sucesso.` });

    } catch (error) {
        console.error(`Erro ao deletar a pasta ${serverPath}:`, error);
        res.status(500).json({ success: false, message: 'Erro ao deletar a pasta do servidor.' });
    }
});


// --- Lógica do Socket.IO ---
io.on('connection', (socket) => {
    console.log('Client connected');
    sendInitialData(socket);

    socket.on('get-initial-data', () => sendInitialData(socket));

    socket.on('create-server', async ({ versionName, serverName }) => {
        const serverDir = path.join(__dirname, serverName);
        try {
            socket.emit('creation-status', `Criando diretório: ${serverName}`);
            await fs.mkdir(serverDir, { recursive: true });

            socket.emit('creation-status', 'Buscando URL de download...');
            const versionMetaUrl = (await getMinecraftVersions()).find(v => v.id === versionName)?.url;
            if (!versionMetaUrl) throw new Error('Versão não encontrada!');
            
            const metaResponse = await axios.get(versionMetaUrl);
            const downloadUrl = metaResponse.data.downloads.server.url;

            socket.emit('creation-status', `Baixando server.jar (versão ${versionName})...`);
            const jarResponse = await axios({ url: downloadUrl, responseType: 'stream' });
            
            const jarPath = path.join(serverDir, 'server.jar');
            const writer = require('fs').createWriteStream(jarPath);
            jarResponse.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            socket.emit('creation-status', 'Download completo. Aceitando EULA...');
            const eulaPath = path.join(serverDir, 'eula.txt');
            await fs.writeFile(eulaPath, 'eula=true');
            
            socket.emit('creation-status', 'Copiando script de inicialização...');
            const startScriptPath = path.join(__dirname, 'start.sh');
            const destScriptPath = path.join(serverDir, 'start.sh');
            await fs.copyFile(startScriptPath, destScriptPath);
            await fs.chmod(destScriptPath, '755');

            socket.emit('creation-status', `\nServidor '${serverName}' criado com sucesso!`);
            socket.emit('creation-status', 'Você já pode selecioná-lo na lista e iniciar.');

            const servers = await getExistingServers();
            io.emit('existing-servers', servers);

        } catch (error) {
            console.error('Error creating server:', error);
            socket.emit('creation-status', `\nERRO: ${error.message}`);
        }
    });
    
    socket.on('start-script', ({ serverDir }) => {
        if (scriptProcess) {
            socket.emit('terminal-output', 'Um servidor já está em execução.\n');
            return;
        }
        const scriptPath = path.join(__dirname, serverDir, 'start.sh');
        const fullServerDir = path.join(__dirname, serverDir);

        fs.access(fullServerDir)
            .then(() => {
                scriptProcess = spawn('bash', [scriptPath], { cwd: fullServerDir });
                io.emit('script-started', serverDir);

                scriptProcess.stdout.on('data', (data) => io.emit('terminal-output', data.toString()));
                scriptProcess.stderr.on('data', (data) => io.emit('terminal-output', `ERROR: ${data.toString()}`));
                scriptProcess.on('close', (code) => {
                    io.emit('terminal-output', `\n--- Script finalizado (código: ${code}) ---\n`);
                    scriptProcess = null;
                    io.emit('script-stopped');
                });
            })
            .catch(err => {
                 socket.emit('terminal-output', `ERRO: O diretório do servidor '${serverDir}' não foi encontrado.\n`);
            });
    });

    socket.on('stop-script', () => {
        io.emit('terminal-output', '\n--- Parando todos os processos (Java e Ngrok)... ---\n');
        stopServerProcess();
    });

    socket.on('disconnect', () => console.log('Client disconnected'));
});

server.listen(PORT, () => {
  console.log(`Painel de controle iniciado na porta ${PORT}`);
  console.log(`Acesse em: http://localhost:${PORT}`);
});
