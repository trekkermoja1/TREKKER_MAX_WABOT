/**
 * TREKKER MAX WABOT - Bot Instance Runner
 * Each instance runs in its own isolated environment
 */
require('dotenv').config();
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const FileType = require('file-type');
const axios = require('axios');
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, sleep, reSize } = require('./lib/myfunc');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const { parsePhoneNumber } = require("libphonenumber-js");
const { rmSync, existsSync } = require('fs');
const { join } = require('path');
const store = require('./lib/lightweight_store');
const http = require('http');

// Get instance configuration from command line arguments
const args = process.argv.slice(2);
const instanceId = args[0] || 'default';
const phoneNumber = args[1] || '';
const apiPort = parseInt(args[2]) || 3001;

// Instance-specific paths
const instanceDir = path.join(__dirname, 'instances', instanceId);
const sessionDir = path.join(instanceDir, 'session');
const dataDir = path.join(instanceDir, 'data');

// Ensure directories exist
if (!fs.existsSync(instanceDir)) fs.mkdirSync(instanceDir, { recursive: true });
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    // Copy default data files
    const defaultDataDir = path.join(__dirname, 'data');
    if (fs.existsSync(defaultDataDir)) {
        fs.readdirSync(defaultDataDir).forEach(file => {
            const src = path.join(defaultDataDir, file);
            const dest = path.join(dataDir, file);
            if (!fs.existsSync(dest)) {
                fs.copyFileSync(src, dest);
            }
        });
    }
}

// Override data directory for this instance
process.env.DATA_DIR = dataDir;

console.log(chalk.cyan(`\n🤖 TREKKER MAX WABOT - Instance: ${instanceId}`));
console.log(chalk.cyan(`📁 Session Dir: ${sessionDir}`));
console.log(chalk.cyan(`📊 Data Dir: ${dataDir}\n`));

// Initialize store
store.readFromFile();
const settings = require('./settings');
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

// Memory optimization
setInterval(() => {
    if (global.gc) {
        global.gc();
    }
}, 60_000);

// Memory monitoring
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024;
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), instance needs restart...');
        process.exit(1);
    }
}, 30_000);

global.botname = "TREKKER MAX WABOT";
global.themeemoji = "🚀";

let pairingCode = null;
let connectionStatus = 'disconnected';
let botSocket = null;

// HTTP Server for API communication
const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/status') {
        res.writeHead(200);
        res.end(JSON.stringify({
            instanceId,
            status: connectionStatus,
            pairingCode,
            phoneNumber,
            user: botSocket?.user || null
        }));
    } else if (req.url === '/pairing-code') {
        res.writeHead(200);
        res.end(JSON.stringify({
            pairingCode,
            status: connectionStatus
        }));
    } else if (req.url === '/stop') {
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'Stopping instance' }));
        setTimeout(() => process.exit(0), 1000);
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(apiPort, () => {
    console.log(chalk.green(`📡 Instance API running on port ${apiPort}`));
});

async function startBot() {
    try {
        let { version, isLatest } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const msgRetryCounterCache = new NodeCache();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["TREKKER MAX", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid);
                let msg = await store.loadMessage(jid, key.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });

        botSocket = sock;
        sock.ev.on('creds.update', saveCreds);
        store.bind(sock.ev);

        // Handle pairing code request
        if (phoneNumber && !sock.authState.creds.registered) {
            connectionStatus = 'pairing';
            const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
            
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(cleanPhone);
                    pairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.green(`\n🔑 Pairing Code: ${pairingCode}\n`));
                } catch (error) {
                    console.error('Error requesting pairing code:', error);
                    connectionStatus = 'error';
                }
            }, 3000);
        }

        // Message handling
        sock.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek.message) return;
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
                
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(sock, chatUpdate);
                    return;
                }
                
                if (!sock.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us');
                    if (!isGroup) return;
                }
                
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

                if (sock?.msgRetryCounterCache) {
                    sock.msgRetryCounterCache.clear();
                }

                try {
                    await handleMessages(sock, chatUpdate, true);
                } catch (err) {
                    console.error("Error in handleMessages:", err);
                }
            } catch (err) {
                console.error("Error in messages.upsert:", err);
            }
        });

        sock.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {};
                return decode.user && decode.server && decode.user + '@' + decode.server || jid;
            } else return jid;
        };

        sock.ev.on('contacts.update', update => {
            for (let contact of update) {
                let id = sock.decodeJid(contact.id);
                if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
            }
        });

        sock.getName = (jid, withoutContact = false) => {
            let id = sock.decodeJid(jid);
            withoutContact = sock.withoutContact || withoutContact;
            let v;
            if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                v = store.contacts[id] || {};
                if (!(v.name || v.subject)) v = sock.groupMetadata(id) || {};
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'));
            });
            else v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } : id === sock.decodeJid(sock.user.id) ? sock.user : (store.contacts[id] || {});
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
        };

        sock.public = true;
        sock.serializeM = (m) => smsg(sock, m, store);

        // Connection handling
        sock.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s;
            
            if (connection === 'connecting') {
                connectionStatus = 'connecting';
                console.log(chalk.yellow('🔄 Connecting to WhatsApp...'));
            }
            
            if (connection == "open") {
                connectionStatus = 'connected';
                pairingCode = null;
                console.log(chalk.green(`\n✅ TREKKER MAX WABOT Connected!`));
                console.log(chalk.cyan(`👤 User: ${JSON.stringify(sock.user, null, 2)}`));

                try {
                    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    await sock.sendMessage(botNumber, {
                        text: `🚀 *TREKKER MAX WABOT Connected!*\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Instance: ${instanceId}\n✅ Status: Online and Ready!`,
                    });
                } catch (error) {
                    console.error('Error sending connection message:', error.message);
                }
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                
                console.log(chalk.red(`Connection closed, reconnecting: ${shouldReconnect}`));
                connectionStatus = 'disconnected';
                
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    try {
                        rmSync(sessionDir, { recursive: true, force: true });
                        fs.mkdirSync(sessionDir, { recursive: true });
                        console.log(chalk.yellow('Session cleared. Re-authentication required.'));
                    } catch (error) {
                        console.error('Error deleting session:', error);
                    }
                    connectionStatus = 'logged_out';
                }
                
                if (shouldReconnect) {
                    console.log(chalk.yellow('Reconnecting in 5 seconds...'));
                    await delay(5000);
                    startBot();
                }
            }
        });

        // Anticall handler
        const antiCallNotified = new Set();
        sock.ev.on('call', async (calls) => {
            try {
                const { readState: readAnticallState } = require('./commands/anticall');
                const state = readAnticallState();
                if (!state.enabled) return;
                for (const call of calls) {
                    const callerJid = call.from || call.peerJid || call.chatId;
                    if (!callerJid) continue;
                    try {
                        if (typeof sock.rejectCall === 'function' && call.id) {
                            await sock.rejectCall(call.id, callerJid);
                        }
                        if (!antiCallNotified.has(callerJid)) {
                            antiCallNotified.add(callerJid);
                            setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                            await sock.sendMessage(callerJid, { text: '📵 Anticall is enabled. Your call was rejected.' });
                        }
                    } catch {}
                    setTimeout(async () => {
                        try { await sock.updateBlockStatus(callerJid, 'block'); } catch {}
                    }, 800);
                }
            } catch (e) {}
        });

        sock.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(sock, update);
        });

        return sock;
    } catch (error) {
        console.error('Error in startBot:', error);
        connectionStatus = 'error';
        await delay(5000);
        startBot();
    }
}

// Start the bot
startBot().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});
