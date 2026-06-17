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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function getWindowTitle(window) {
  if (!window) return ''
  if (typeof window.title === 'string') return window.title
  if (window.title && typeof window.title === 'object') {
    if (window.title.text) return window.title.text
    if (window.title.translate) return window.title.translate
    try {
      return JSON.stringify(window.title)
    } catch (_) {
      return ''
    }
  }
  return ''
}

function stripColor(str) {
  if (!str) return ''
  if (typeof str !== 'string') {
    try {
      str = String(str)
    } catch (_) {
      return ''
    }
  }
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

  bot.on('login', async () => {
    log('OK', `Dang nhap! User: ${config.username}`)
    
    await sleep(30000)
    bot.chat(`/dk ${config.botPassword}`)
    log('BOT', 'Dang ky: /dk')
    
    await sleep(30000)
    bot.chat(`/dn ${config.botPassword}`)
    log('BOT', 'Dang nhap: /dn')
    
    await sleep(30000)
    bot.chat('/menu')
    log('BOT', 'Da gui /menu')
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
    const title = getWindowTitle(window)
    const cleanTitle = stripColor(title).toLowerCase()
    log('GUI', `Cua so: "${cleanTitle}"`)

    if (inLobby && (cleanTitle.includes('menu') || cleanTitle.includes('server'))) {
      await sleep(30000)
      bot.clickWindow(24, 0, 0)
      log('BOT', 'Click slot 24 -> vao KingSMP')
      inLobby = false
      
      await sleep(30000)
      bot.chat('/afk')
      log('BOT', 'Da gui /afk')
    }

    if (cleanTitle.includes('afk') && !afkDone) {
      await sleep(30000)
      const slot = config.afkSlot ?? 0
      bot.clickWindow(slot, 0, 0)
      log('BOT', `Click slot ${slot} -> AFK`)
      afkDone = true
      startAntiAFK()
      log('OK', 'Dang AFK')
    }
  })

  bot.on('death', () => {
    stopAntiAFK()
    afkDone = false
    inLobby = true
    log('WARN', '💀 Bot chet! Respawn...')
    setTimeout(async () => {
      if (!bot) return
      bot.respawn()
      log('OK', 'Da respawn!')
    }, 5000)
  })

  bot.on('end', () => {
    stopAntiAFK()
    if (reconnecting) return
    reconnecting = true
    log('WARN', 'Mat ket noi! Reconnect...')
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
