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
let scriptProcess = null;
const minecraftVersionsUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

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
            .filter(dirent => dirent.isDirectory() && !['node_modules', 'public'].includes(dirent.name) && !dirent.name.startsWith('.'))
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

const stopServerProcess = (callback) => {
    exec("pkill -f 'java -Xmx' && pkill -f ngrok", (err) => {
        if (err && !err.message.includes('no process found')) {
            console.error('Error stopping processes:', err.message);
        }
        if (scriptProcess) {
            scriptProcess.kill('SIGINT');
            scriptProcess = null;
        }
        io.emit('script-stopped');
        console.log('Server processes stopped.');
        if (callback) callback();
    });
};

app.get('/ip', async (req, res) => {
    try {
        const response = await axios.get('http://127.0.0.1:4040/api/tunnels');
        const tcpTunnel = response.data.tunnels.find(t => t.proto === 'tcp');
        res.json({ ip: tcpTunnel ? tcpTunnel.public_url.replace('tcp://', '') : 'buscando...' });
    } catch (error) {
        res.status(503).json({ ip: 'indisponível' });
    }
});

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
            const commonFiles = ['start.sh', 'ngrok'];
            for (const file of commonFiles) {
                const src = path.join(__dirname, file);
                const dest = path.join(serverDir, file);
                await fsp.copyFile(src, dest);
                await fsp.chmod(dest, '755');
            }

            socket.emit('creation-status', `\nServidor '${serverName}' criado com sucesso!`);
            io.emit('existing-servers', await getExistingServers());
        } catch (error) {
            console.error('[CREATE-SERVER] FATAL ERROR:', error);
            socket.emit('creation-status', `\nERRO: ${error.message}`);
            try { await rimraf(serverDir); } catch (e) { console.error('Cleanup failed:', e); }
        }
    });
    
    socket.on('start-script', async ({ serverDir }) => {
        if (scriptProcess) {
            socket.emit('terminal-output', `\n--- Um servidor já está em execução. Pare-o primeiro. ---\n`);
            return;
        }
        const fullServerDir = path.join(__dirname, serverDir);

        try {
            console.log(`[DIAGNOSTIC] Atualizando scripts em ${serverDir}...`);
            const rootDir = __dirname;
            const filesToCopy = ['start.sh', 'ngrok'];
            for (const file of filesToCopy) {
                const src = path.join(rootDir, file);
                const dest = path.join(fullServerDir, file);
                await fsp.copyFile(src, dest);
                await fsp.chmod(dest, '755');
            }
            console.log(`[DIAGNOSTIC] Scripts atualizados com sucesso.`);
        } catch (error) {
            console.error(`[DIAGNOSTIC] Falha ao copiar scripts:`, error);
            socket.emit('terminal-output', `\n--- ERRO: Falha ao atualizar os scripts de inicialização. ---\n`);
            return;
        }

        const scriptPath = path.join(fullServerDir, 'start.sh');
        console.log(`[DIAGNOSTIC] Tentando parar processos antigos antes de iniciar.`);
        stopServerProcess(() => {
            console.log(`[DIAGNOSTIC] Iniciando script: ${scriptPath} em ${fullServerDir}`);
            
            scriptProcess = spawn('bash', [scriptPath], { cwd: fullServerDir, stdio: 'pipe' });
            
            console.log(`[DIAGNOSTIC] Processo spawnado com PID: ${scriptProcess.pid}`);
            io.emit('script-started', serverDir);

            scriptProcess.on('error', (err) => {
                console.error('[DIAGNOSTIC] FALHA AO INICIAR PROCESSO:', err);
                io.emit('terminal-output', `\n--- ERRO CRÍTICO: Não foi possível iniciar o processo do servidor. Verifique os logs do painel. ---\n`);
            });

            scriptProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[DIAGNOSTIC STDOUT]:\n${output}`);
                io.emit('terminal-output', output);
            });

            scriptProcess.stderr.on('data', (data) => {
                const output = `STDERR: ${data.toString()}`;
                console.error(`[DIAGNOSTIC STDERR]:\n${output}`);
                io.emit('terminal-output', output);
            });

            scriptProcess.on('close', (code) => {
                console.log(`[DIAGNOSTIC] Processo finalizado com código: ${code}`);
                io.emit('script-stopped');
                io.emit('terminal-output', `\n--- Processo do servidor finalizado (código: ${code}) ---\n`);
                scriptProcess = null;
            });

            scriptProcess.on('exit', (code) => {
                console.log(`[DIAGNOSTIC] Evento 'exit' do processo com código: ${code}`);
            });
        });
    });

    socket.on('stop-script', () => {
        if (!scriptProcess) {
             socket.emit('terminal-output', `\n--- Nenhum servidor em execução para parar. ---\n`);
             return;
        }
        io.emit('terminal-output', `\n--- Parando o servidor... ---\n`);
        stopServerProcess();
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

server.listen(PORT, () => {
  console.log(`Painel de controle iniciado em http://localhost:${PORT}`);
});