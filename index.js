const mineflayer = require("mineflayer")
const config = require('./config.json')

let bot = null
let reconnecting = false
let afkInterval = null
let startTime = Date.now()
let inLobby = true
let afkDone = false

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m',
  blue: '\x1b[34m', white: '\x1b[37m', bold: '\x1b[1m',
}

function log(type, msg) {
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
  log('BOT', 'Da gui /afk...')
}

function start_bot() {
  inLobby = true
  afkDone = false

  console.log('Loading config:', {
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version
  })

  bot = mineflayer.createBot({
    host: config.host || "kingsmp.vn",
    port: config.port || 25565,
    username: config.username || "AnhvendzXD",
    version: config.version || "1.21",
    respawn: true,
  })

  bot.on('login', () => {
    log('OK', `Dang nhap! User: ${config.username || "AnhvendzXD"}`)
    if (!config.registered) {
      setTimeout(() => {
        bot.chat(`/dk ${config.botPassword || "nguyendz1212"}`)
        config.registered = true
        log('BOT', 'Dang ky: /dk')
      }, 2000)
    } else {
      setTimeout(() => {
        bot.chat(`/dn ${config.botPassword || "nguyendz1212"}`)
        log('BOT', 'Dang nhap: /dn')
      }, 2000)
    }
  })

  bot.on('spawn', () => {
    log('OK', 'Spawn vao server!')
  })

  bot.on('chat', (username, message) => {
    log('CHAT', `<${username}> ${message}`)
  })

  bot.on('messagestr', (message, position) => {
    if (!message || message.trim() === '') return
    if (position === 'chat' || position === 'system') {
      log('INFO', `[${position}] ${message}`)
    }
  })

  bot.on('windowOpen', async (window) => {
    const title = stripColor(window.title || '')
    log('GUI', `Cua so: "${title}"`)

    window.slots.forEach((item, i) => {
      if (item && item.type !== 0) {
        const name = item.customName ? stripColor(item.customName) : item.name
        log('GUI', `  Slot ${String(i).padStart(2)}: [${item.name}] "${name}"`)
      }
    })

    if (inLobby) {
      await sleep(2653)
      bot.clickWindow(24, 0, 0)
      log('BOT', 'Click slot 24 -> vao KingSMP...')
      inLobby = false
      return
    }

    if (title.toLowerCase().includes('afk') && !afkDone) {
      await sleep(800, 300)
      const slot = config.afkSlot ?? 0
      bot.clickWindow(slot, 0, 0)
      log('BOT', `Click slot ${slot} -> khu AFK ${slot + 1}`)
      afkDone = true
      startAntiAFK()
      log('OK', 'Dang treo AFK ♾️')
    }
  })

  bot.on('death', () => {
    stopAntiAFK()
    afkDone = false
    log('WARN', '💀 Bot chet! Respawn sau 3-8s...')
    const delay = Math.floor(Math.random() * 5000) + 3000
    setTimeout(async () => {
      if (!bot) return
      bot.respawn()
      log('OK', 'Da respawn! Doi 5s roi /afk lai...')
      await sleep(5000, 1000)
      goAfk()
    }, delay)
  })

  bot.on('end', () => {
    stopAntiAFK()
    if (reconnecting) return
    reconnecting = true
    log('WARN', 'Mat ket noi! Reconnect sau 5s...')
    setTimeout(() => {
      reconnecting = false
      start_bot()
    }, 5000)
  })

  bot.on('error', (err) => {
    log('ERROR', `Loi: ${err.message}`)
  })

  setInterval(() => {
    if (!bot || !bot.entity) return
    const pos = bot.entity.position
    log('INFO', `Uptime: ${getUptime()} | HP: ${Math.round(bot.health)}/20 | Food: ${bot.food}/20 | Pos: (${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)})`)
  }, 60000)
}

console.log(`\n${C.cyan}${C.bold}╔════════════════════════════════════╗`)
console.log(`║   Minecraft AFK Bot  •  Java 1.21  ║`)
console.log(`╚════════════════════════════════════╝${C.reset}\n`)

start_bot()

process.on('SIGINT', () => {
  stopAntiAFK()
  try { if (bot) bot.quit() } catch (_) {}
  process.exit(0)
})

process.on('uncaughtException', (err) => {
  log('ERROR', `Uncaught: ${err.message}`)
})
