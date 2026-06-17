const mineflayer = require("mineflayer")
const readline = require("readline")
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js')
const config = require('./config.json')

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
})

let logChannel = null
let bot = null
let reconnecting = false
let afkInterval = null
let startTime = Date.now()
let inLobby = true
let afkDone = false

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m',
  blue: '\x1b[34m', white: '\x1b[37m', bold: '\x1b[1m',
}

function clog(type, msg) {
  const time = new Date().toLocaleTimeString('vi-VN')
  const map = {
    INFO:  `${C.cyan}${C.bold}[INFO]  ${C.reset}`,
    OK:    `${C.green}${C.bold}[OK]    ${C.reset}`,
    WARN:  `${C.yellow}${C.bold}[WARN]  ${C.reset}`,
    ERROR: `${C.red}${C.bold}[ERROR] ${C.reset}`,
    CHAT:  `${C.magenta}${C.bold}[CHAT]  ${C.reset}`,
    BOT:   `${C.blue}${C.bold}[BOT]   ${C.reset}`,
    GUI:   `${C.yellow}${C.bold}[GUI]   ${C.reset}`,
  }
  console.log(`${C.white}[${time}]${C.reset} ${map[type] || '[LOG]'}${msg}`)
}

function getUptime() {
  const s = Math.floor((Date.now() - startTime) / 1000)
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ${s%60}s`
}

async function dlog(type, msg) {
  if (!logChannel) return
  const colors = {
    INFO: 0x00bfff, OK: 0x00c853, WARN: 0xffab00,
    ERROR: 0xff1744, CHAT: 0xaa00ff, BOT: 0x448aff, GUI: 0xff6d00,
  }
  const emojis = {
    INFO: 'ℹ️', OK: '✅', WARN: '⚠️', ERROR: '❌',
    CHAT: '💬', BOT: '🤖', GUI: '🖥️',
  }
  try {
    const embed = new EmbedBuilder()
      .setColor(colors[type] || 0x888888)
      .setDescription(`${emojis[type] || '•'} ${msg}`)
      .setTimestamp()
    await logChannel.send({ embeds: [embed] })
  } catch (_) {}
}

function log(type, msg) {
  clog(type, msg)
  dlog(type, msg)
}

function sleep(ms, jitter = 0) {
  return new Promise(r => setTimeout(r, ms + (jitter ? Math.floor(Math.random() * jitter) : 0)))
}

function stripColor(str) {
  try {
    const extract = (o) => {
      if (typeof o === 'string') return o
      let t = o.text || o.translate || ''
      if (o.extra) t += o.extra.map(extract).join('')
      if (o.with) t += o.with.map(extract).join('')
      return t
    }
    return extract(JSON.parse(str)).replace(/§./g, '')
  } catch (_) {}
  return str.replace(/§./g, '').replace(/\u00A7./g, '')
}

function startAntiAFK() {
  clearInterval(afkInterval)
  afkInterval = setInterval(() => {
    if (!bot) return
    bot.setControlState('jump', true)
    setTimeout(() => { if (bot) bot.setControlState('jump', false) }, 200)
  }, 5000)
}

function stopAntiAFK() {
  clearInterval(afkInterval)
  afkInterval = null
}

async function goAfk() {
  if (!bot) return
  afkDone = false
  await sleep(2000, 500)
  bot.chat('/afk')
  log('BOT', 'Gửi /afk...')
}

function start_bot() {
  inLobby = true
  afkDone = false

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    respawn: true,
  })

  bot.on('login', () => {
    log('OK', `Đăng nhập! User: **${config.username}**`)
    if (!config.registered) {
      setTimeout(() => {
        bot.chat(`/dk ${config.botPassword}`)
        config.registered = true
        log('BOT', `Đăng ký: /dk`)
      }, 2000)
    } else {
      setTimeout(() => {
        bot.chat(`/dn ${config.botPassword}`)
        log('BOT', `Đăng nhập: /dn`)
      }, 2000)
    }
  })

  bot.on('spawn', () => {
    log('OK', 'Spawn vào server!')
  })

  bot.on('chat', (username, message) => {
    clog('CHAT', `<${username}> ${message}`)
    dlog('CHAT', `**${username}**: ${message}`)
  })

  bot.on('messagestr', (message, position) => {
    if (!message || message.trim() === '') return
    clog('INFO', `[${position}] ${message}`)
    if (position === 'chat' || position === 'system') {
      dlog('INFO', `\`${message}\``)
    }
  })

  bot.on('windowOpen', async (window) => {
    const title = stripColor(window.title || '')
    log('GUI', `Cửa sổ: "${title}"`)

    window.slots.forEach((item, i) => {
      if (item && item.type !== 0) {
        const name = item.customName ? stripColor(item.customName) : item.name
        clog('GUI', `  Slot ${String(i).padStart(2)}: [${item.name}] "${name}"`)
      }
    })

    if (inLobby) {
      await sleep(2653)
      bot.clickWindow(24, 0, 0)
      log('BOT', 'Click slot 24 → vào KingSMP...')
      inLobby = false
      return
    }

    if (title.toLowerCase().includes('afk') && !afkDone) {
      if (logChannel) {
        const items = []
        window.slots.forEach((item, i) => {
          if (item && item.type !== 0) {
            const name = item.customName ? stripColor(item.customName) : item.name
            items.push(`Slot ${i}: \`${name}\``)
          }
        })
        if (items.length) {
          const embed = new EmbedBuilder()
            .setColor(0xff6d00)
            .setTitle('🖥️ Menu AFK')
            .setDescription(items.slice(0, 25).join('\n'))
            .setTimestamp()
          logChannel.send({ embeds: [embed] })
        }
      }
      await sleep(800, 300)
      const slot = config.afkSlot ?? 0
      bot.clickWindow(slot, 0, 0)
      log('BOT', `Click slot ${slot} → khu AFK ${slot + 1}`)
      afkDone = true
      startAntiAFK()
      log('OK', 'Đang treo AFK ♾️')
    }
  })

  bot.on('death', () => {
    stopAntiAFK()
    afkDone = false
    log('WARN', '💀 Bot chết! Respawn sau 3-8s...')
    const delay = Math.floor(Math.random() * 5000) + 3000
    setTimeout(async () => {
      if (!bot) return
      bot.respawn()
      log('OK', 'Đã respawn! Đợi 5s rồi /afk lại...')
      await sleep(5000, 1000)
      goAfk()
    }, delay)
  })

  bot.on('end', () => {
    stopAntiAFK()
    if (reconnecting) return
    reconnecting = true
    log('WARN', 'Mất kết nối! Reconnect sau 5s...')
    setTimeout(() => {
      reconnecting = false
      start_bot()
    }, 5000)
  })

  bot.on('error', (err) => {
    log('ERROR', `Lỗi: ${err.message}`)
  })

  rl.removeAllListeners('line')
  rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase()
    if (cmd === 'afk') {
      goAfk()
    } else if (cmd === 'stop') {
      stopAntiAFK()
      log('INFO', 'Dừng AFK')
    } else if (cmd === 'status') {
      log('INFO', `Uptime: ${getUptime()}`)
    } else if (cmd === 'exit') {
      reconnecting = false
      stopAntiAFK()
      if (bot) bot.quit()
      process.exit(0)
    } else if (line.startsWith('say ')) {
      if (bot) bot.chat(line.slice(4))
    }
  })
}

discord.on('ready', async () => {
  clog('OK', `Discord online: ${discord.user.tag}`)
  logChannel = discord.channels.cache.get(config.discord.logChannelId)
  if (!logChannel) { clog('ERROR', 'Không tìm thấy logChannelId!'); return }
  clog('OK', `Log channel: #${logChannel.name}`)
  const embed = new EmbedBuilder()
    .setColor(0x00c853)
    .setTitle('🟢 Bot Discord online!')
    .setDescription('`!start` — Bật\n`!stop` — Tắt\n`!afk` — /afk\n`!status` — Trạng thái\n`!help` — Lệnh')
    .setTimestamp()
  logChannel.send({ embeds: [embed] })
})

discord.on('messageCreate', async (message) => {
  if (message.author.bot) return
  if (message.channelId !== config.discord.logChannelId) return

  const cmd = message.content.trim().toLowerCase()

  if (cmd === '!start') {
    if (bot && !reconnecting) { message.reply('⚠️ Bot đang chạy rồi!'); return }
    startTime = Date.now()
    message.reply('✅ Đang khởi động...')
    start_bot()
  }
  else if (cmd === '!stop') {
    reconnecting = false
    stopAntiAFK()
    if (bot) { try { bot.quit() } catch (_) {} }
    bot = null
    message.reply('🛑 Đã dừng.')
  }
  else if (cmd === '!afk') {
    if (!bot) { message.reply('⚠️ Bot chưa chạy!'); return }
    goAfk()
    message.reply('✅ Đã gửi /afk')
  }
  else if (cmd === '!status') {
    const embed = new EmbedBuilder()
      .setColor(bot ? 0x00c853 : 0xff1744)
      .setTitle('📊 Trạng thái')
      .addFields(
        { name: 'Bot',    value: bot ? '🟢 Online' : '🔴 Offline', inline: true },
        { name: 'User',   value: config.username, inline: true },
        { name: 'Server', value: `${config.host}:${config.port}`, inline: true },
        { name: 'Uptime', value: getUptime(), inline: true },
        { name: 'AFK',    value: afkDone ? '✅ Đang AFK' : '❌ Chưa AFK', inline: true },
      )
      .setTimestamp()
    if (bot?.entity) {
      const pos = bot.entity.position
      embed.addFields(
        { name: 'HP',  value: `${Math.round(bot.health)}/20`, inline: true },
        { name: 'Pos', value: `(${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)})`, inline: true },
      )
    }
    message.reply({ embeds: [embed] })
  }
  else if (cmd === '!help') {
    const embed = new EmbedBuilder()
      .setColor(0x448aff)
      .setTitle('📖 Lệnh')
      .addFields(
        { name: '!start',  value: 'Khởi động bot' },
        { name: '!stop',   value: 'Dừng bot' },
        { name: '!afk',    value: 'Gõ /afk vào server' },
        { name: '!status', value: 'Xem trạng thái' },
        { name: '!help',   value: 'Xem lệnh này' },
      )
    message.reply({ embeds: [embed] })
  }
})

console.log(`\n${C.cyan}${C.bold}╔════════════════════════════════════╗`)
console.log(`║   Minecraft AFK Bot  •  Java 1.21  ║`)
console.log(`║   Discord Control Panel            ║`)
console.log(`╚════════════════════════════════════╝${C.reset}\n`)

discord.login(config.discord.token).catch(err => {
  clog('ERROR', `Discord login thất bại: ${err.message}`)
  process.exit(1)
})

process.on('SIGINT', () => {
  stopAntiAFK()
  try { if (bot) bot.quit() } catch (_) {}
  discord.destroy()
  process.exit(0)
})

process.on('uncaughtException', (err) => {
  clog('ERROR', `Uncaught: ${err.message}`)
})
