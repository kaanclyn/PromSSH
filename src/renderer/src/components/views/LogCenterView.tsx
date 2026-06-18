import React, { useState, useEffect, useRef } from 'react'
import { FileText, RefreshCw, Search, ArrowDown, ShieldAlert, Info, Sparkles, Filter } from 'lucide-react'

interface LogCenterViewProps {
  connectionId: number | string
}

interface LogSource {
  id: string
  name: string
  type: 'file' | 'docker' | 'pm2' | 'systemd' | 'promssh'
  pathOrName: string
}

interface LogAnalysis {
  category: string
  explanation: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  suggestion: string
}

interface GuideError {
  title: string
  code: string
  category: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  explanation: string
  suggestion: string
}

const COMMON_ERRORS_GUIDE: GuideError[] = [
  {
    title: "RAM Bellek Doldu ve Süreç Sonlandırıldı (OOM-Killer)",
    code: "kernel: Out of memory: Killed process 28491 (node) total-vm:432104kB, anon-rss:12043kB",
    category: "Sistem / Donanım Yetersizliği",
    severity: "critical",
    explanation: "Sunucudaki fiziksel RAM (bellek) tamamen dolmuştur. Linux çekirdeği (kernel), işletim sisteminin çökmesini veya yanıt vermez hale gelmesini önlemek için en çok bellek harcayan süreci (bu örnekte Node.js uygulamasını) zorla sonlandırmıştır.",
    suggestion: "1. Sunucunun RAM kapasitesini yükseltin.\n2. Sunucuda sanal bellek (Swap) alanı oluşturarak sistemin geçici olarak rahatlamasını sağlayın:\n   sudo fallocate -l 2G /swapfile\n   sudo chmod 600 /swapfile\n   sudo mkswap /swapfile\n   sudo swapon /swapfile\n   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab\n3. Uygulamanızdaki bellek sızıntılarını (memory leaks) analiz edin."
  },
  {
    title: "SSH Başarısız Giriş Denemesi / Brute-Force Saldırısı",
    code: "sshd[19384]: Failed password for invalid user admin from 185.220.101.4 port 54829 ssh2",
    category: "Güvenlik / Brute-Force",
    severity: "critical",
    explanation: "Dış ağdan yetkisiz veya şüpheli bir IP adresi, sunucunuza varsayılan SSH portu (22) üzerinden 'admin' kullanıcı adıyla başarısız şifre denemeleri yapmaktadır. Bu durum otomatik botlar tarafından yapılan brute-force (kaba kuvvet) saldırısına işaret eder.",
    suggestion: "1. SSH portunu varsayılan 22 portundan farklı bir porta taşıyın:\n   sudo nano /etc/ssh/sshd_config (Port 2222 yapıp kaydedin)\n   sudo systemctl restart sshd\n2. Fail2ban kurarak üst üste hatalı deneme yapan IP'leri otomatik bloklayın:\n   sudo apt install fail2ban\n3. Şifre ile girişi tamamen kapatıp SSH anahtarı (SSH Key) kullanın."
  },
  {
    title: "SSL/TLS Sertifika Uyuşmazlığı & Eski İstemci Hatası",
    code: "dovecot: pop3-login: Disconnected: Connection closed: SSL_accept() failed: error:0A000076:SSL routines::no suitable signature algorithm",
    category: "Güvenlik / SSL/TLS Protokol Hatası",
    severity: "warning",
    explanation: "Sunucunuzdaki posta servisi (Dovecot/Postfix) veya web sunucusu (Nginx), istemcinin (bağlanmaya çalışan bilgisayar/tarayıcı) sunduğu SSL/TLS şifreleme sürümünü veya imza algoritmasını desteklemiyor. İstemci eski ve güvensiz bir SSL protokolüyle bağlanmaya çalışıyor olabilir.",
    suggestion: "1. SSL/TLS sertifikasının geçerliliğini ve süresini doğrulayın.\n2. Sunucu tarafında desteklenen modern TLS protokollerini (TLSv1.2, TLSv1.3) ve şifre setlerini (ciphers) güncelleyin:\n   Nginx için: ssl_protocols TLSv1.2 TLSv1.3;\n3. Let's Encrypt kullanıyorsanız sertifikaları yenileyin:\n   sudo certbot renew"
  },
  {
    title: "Nginx 502 Bad Gateway / Port Bağlantı Reddedildi",
    code: "nginx[8573]: *10392 connect() failed (111: Connection refused) while connecting to upstream, client: 85.90.12.3",
    category: "Web Sunucu / Upstream Hatası",
    severity: "error",
    explanation: "Nginx web sunucunuz, gelen istekleri arkada çalışan asıl uygulamaya (örneğin PM2 altındaki Node.js veya PHP-FPM) yönlendirmek istedi. Ancak arkadaki uygulama ya kapalı ya da Nginx'in yönlendirdiği portu (örneğin 3000) dinlemiyor.",
    suggestion: "1. Arkada çalışan uygulamanızın durumunu kontrol edin:\n   pm2 status  veya  systemctl status node-app\n2. Uygulamanızın doğru portta çalıştığını doğrulamak için portları listeleyin:\n   sudo netstat -tulpn | grep LISTEN\n3. Nginx konfigürasyonundaki (proxy_pass) port numarası ile uygulamanızın portunu eşitleyin."
  },
  {
    title: "Sunucu Disk Alanı Tamamen Dolu",
    code: "write error: No space left on device or disk quota exceeded",
    category: "Sistem / Depolama Sorunu",
    severity: "critical",
    explanation: "Sunucunuzdaki disk alanı veya dosya sistemi %100 doluluğa ulaşmıştır. Disk dolduğunda veritabanları yeni kayıt yazamaz, log dosyaları oluşturulamaz ve işletim sistemindeki birçok temel servis çalışmayı durdurur.",
    suggestion: "1. Disk doluluk oranını kontrol edin:\n   df -h\n2. En çok yer kaplayan klasörleri ve dosyaları bulun:\n   sudo du -ah / | sort -rh | head -n 15\n3. Docker çöp dosyalarını temizleyin:\n   docker system prune -a --volumes\n4. Eski sistem loglarını temizleyin:\n   sudo journalctl --vacuum-size=100M"
  },
  {
    title: "Systemd Servisi Beklenmedik Şekilde Çöktü",
    code: "systemd[1]: my-backend.service: Failed with result 'exit-code'.",
    category: "Servis Hatası / Çökme",
    severity: "error",
    explanation: "İşletim sisteminde arka planda çalışan bir systemd servisi (örneğin web uygulamanız, veritabanı veya API servisi), kod hatası, bellek hatası veya eksik dosya nedeniyle sıfırdan farklı bir çıkış koduyla beklenmedik bir şekilde durmuştur.",
    suggestion: "1. Servisin detaylı çökme nedenini ve son loglarını inceleyin:\n   sudo journalctl -u my-backend.service -n 50 --no-pager\n2. Servis konfigürasyonunda otomatik yeniden başlatma (Restart=always) kuralının aktif olduğunu doğrulayın:\n   nano /etc/systemd/system/my-backend.service"
  },
  {
    title: "Nginx Yetkilendirme Gerekli (401 Unauthorized)",
    code: "nginx[8573]: *10405 no user/password was provided for basic authentication",
    category: "Web Sunucu / Yetkisiz Erişim",
    severity: "warning",
    explanation: "HTTP Basic Authentication korumalı bir web sayfasına veya API uç noktasına şifre/kullanıcı adı girmeden veya yanlış kimlik bilgileriyle erişilmeye çalışılmış.",
    suggestion: "1. İstemcinin doğru 'Authorization' HTTP başlığını (header) gönderdiğinden emin olun.\n2. Şifreyi unuttuysanız sunucudaki .htpasswd dosyasını yeniden oluşturun veya güncelleyin:\n   sudo htpasswd -c /etc/nginx/.htpasswd kullanici_adi"
  },
  {
    title: "Pure-FTPd Başarısız Giriş Denemesi",
    code: "pure-ftpd: (?@94.76.60.18) [WARNING] Authentication failed for user [anonymous]",
    category: "Güvenlik / FTP Giriş Hatası",
    severity: "warning",
    explanation: "Dış ağdan bir istemci veya bot, sunucudaki FTP servisine 'anonymous' (anonim) kullanıcı adıyla giriş yapmaya çalışmış fakat FTP sunucusu yetkisiz girişi engellemiştir.",
    suggestion: "1. Sunucunuzda anonim FTP girişine izin vermiyorsanız bu normaldir ve saldırıyı engellediğini gösterir.\n2. FTP yerine daha güvenli olan SFTP (SSH üzerinden dosya aktarımı) protokolünü kullanmayı tercih edin."
  }
]

export const LogCenterView: React.FC<LogCenterViewProps> = ({ connectionId }) => {
  const [sources, setSources] = useState<LogSource[]>([
    { id: 'promssh_debug', name: 'PromSSH Uygulama & Hata Teşhis Logları', type: 'promssh', pathOrName: 'promssh' },
    { id: 'syslog', name: 'System Logs (Syslog)', type: 'file', pathOrName: '/var/log/syslog' },
    { id: 'authlog', name: 'Auth Logs', type: 'file', pathOrName: '/var/log/auth.log' },
    { id: 'nginx_access', name: 'Nginx Access Logs', type: 'file', pathOrName: '/var/log/nginx/access.log' },
    { id: 'nginx_error', name: 'Nginx Error Logs', type: 'file', pathOrName: '/var/log/nginx/error.log' },
    { id: 'journald', name: 'Systemd Journal', type: 'systemd', pathOrName: 'journald' }
  ])
  const [selectedSource, setSelectedSource] = useState<string>('promssh_debug')
  const [logLines, setLogLines] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [linesCount, setLinesCount] = useState<number>(100)
  const [filterErrors, setFilterErrors] = useState<boolean>(false)
  const [selectedLine, setSelectedLine] = useState<string | null>(null)
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null)
  
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchDockerAndPM2Sources()
  }, [connectionId])

  useEffect(() => {
    fetchLogs()
    setSelectedLine(null)
    setSelectedLineIndex(null)
  }, [connectionId, selectedSource, linesCount])

  const fetchDockerAndPM2Sources = async (): Promise<void> => {
    try {
      // 1. Fetch Docker containers
      const dockerRes = await window.api.sshExec(connectionId, 'docker ps --format "{{.ID}} {{.Names}}" 2>/dev/null')
      const dockerSources: LogSource[] = []
      if (!dockerRes.error && dockerRes.stdout.trim()) {
        dockerRes.stdout.split('\n').forEach((line) => {
          const parts = line.trim().split(' ')
          if (parts.length >= 2) {
            dockerSources.push({
              id: `docker_${parts[0]}`,
              name: `Docker: ${parts[1]}`,
              type: 'docker',
              pathOrName: parts[0]
            })
          }
        })
      }

      // 2. Fetch PM2 list
      const pm2Res = await window.api.sshExec(connectionId, 'pm2 jlist 2>/dev/null')
      const pm2Sources: LogSource[] = []
      if (!pm2Res.error && pm2Res.stdout.trim()) {
        const startIdx = pm2Res.stdout.indexOf('[')
        const endIdx = pm2Res.stdout.lastIndexOf(']')
        if (startIdx !== -1 && endIdx !== -1) {
          const list = JSON.parse(pm2Res.stdout.substring(startIdx, endIdx + 1))
          list.forEach((proc: any) => {
            pm2Sources.push({
              id: `pm2_${proc.pm_id}`,
              name: `PM2: ${proc.name}`,
              type: 'pm2',
              pathOrName: String(proc.pm_id)
            })
          })
        }
      }

      setSources((prev) => {
        const staticList = prev.filter((s) => s.type === 'file' || s.type === 'systemd' || s.type === 'promssh')
        return [...staticList, ...dockerSources, ...pm2Sources]
      })
    } catch (e) {
      // ignore
    }
  }

  const fetchLogs = async (): Promise<void> => {
    setLoading(true)
    try {
      const source = sources.find((s) => s.id === selectedSource)
      if (!source) return

      if (source.type === 'promssh') {
        const logs = await window.api.sshGetDebugLogs()
        setLogLines(logs.length > 0 ? logs : ['Henüz bağlantı logu oluşturulmadı.'])
        setLoading(false)
        setTimeout(() => {
          logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
        return
      }

      let cmd = ''
      if (source.type === 'file') {
        cmd = `tail -n ${linesCount} ${source.pathOrName} 2>/dev/null || cat ${source.pathOrName} | tail -n ${linesCount} 2>/dev/null || echo "Log dosyası okunamadı veya dosya boş."`
      } else if (source.type === 'docker') {
        cmd = `docker logs --tail ${linesCount} ${source.pathOrName} 2>&1`
      } else if (source.type === 'pm2') {
        cmd = `pm2 logs ${source.pathOrName} --lines ${linesCount} --raw --nostream 2>&1`
      } else if (source.type === 'systemd') {
        cmd = `journalctl -n ${linesCount} --no-pager 2>/dev/null || tail -n ${linesCount} /var/log/syslog`
      }

      const res = await window.api.sshExec(connectionId, cmd)
      if (res.error) {
        setLogLines([`Log çekme hatası: ${res.error}`])
      } else {
        const lines = res.stdout.split('\n').filter((l) => l !== '')
        setLogLines(lines.length > 0 ? lines : ['Kayıt bulunamadı.'])
        setTimeout(() => {
          logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    } catch (e: any) {
      setLogLines([`Hata: ${e.message}`])
    } finally {
      setLoading(false)
    }
  }

  const handleScrollToBottom = (): void => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Rule-based Log Line Interpreter (Turkish)
  const interpretLogLine = (line: string): LogAnalysis => {
    const lower = line.toLowerCase()

    // 1. SSL & TLS Errors
    if (lower.includes('no suitable signature algorithm') || lower.includes('ssl routines') || lower.includes('ssl_accept') || lower.includes('handshaking: ssl_accept')) {
      return {
        category: 'SSL/TLS Protokol Uyuşmazlığı',
        severity: 'warning',
        explanation: 'Sunucu ile istemci arasında SSL/TLS protokolü veya şifreleme algoritması uyuşmazlığı saptandı. Genelde eski bir e-posta istemcisi ya da eski bir tarayıcı, sunucunun desteklemediği güvensiz bir şifreleme ile bağlanmaya çalışmaktadır.',
        suggestion: 'Nginx, Dovecot veya Apache ayarlarınızdan modern şifreleme protokollerini (TLSv1.2, TLSv1.3) ve güvenli algoritmaları aktif edin. İstemcinin güncel bir tarayıcı/yazılım kullandığından emin olun.'
      }
    }
    
    // 2. SSH Brute Force
    if (lower.includes('auth attempts in') || lower.includes('failed password') || lower.includes('invalid user') || lower.includes('authentication failed')) {
      return {
        category: 'Güvenlik / Yetkisiz Giriş Denemesi',
        severity: 'critical',
        explanation: 'Sunucuya yetkisiz bir kullanıcı adı veya şifre ile giriş denemesi yapılmıştır. Bu loglar sürekli tekrarlanıyorsa otomatik botlar tarafından yapılan kaba kuvvet (brute-force) saldırısı gerçekleşiyor demektir.',
        suggestion: 'SSH portunuzu 22\'den başka bir porta taşıyın. Sunucuya Fail2ban kurarak saldırgan IP adreslerini otomatik banlayın. Şifreyle giriş yerine SSH Key yetkilendirmesi kullanın.'
      }
    }

    // 3. Out of memory
    if (lower.includes('oom') || lower.includes('out of memory') || lower.includes('killed process')) {
      return {
        category: 'Sistem / RAM Bellek Yetersizliği',
        severity: 'critical',
        explanation: 'Sunucudaki fiziksel RAM (bellek) tamamen tükenmiştir. Linux çekirdeği (kernel) sistemin tamamen donmasını engellemek için en fazla RAM harcayan servisi (örneğin Node, MySQL veya Java) zorla sonlandırmıştır.',
        suggestion: 'Sunucuda RAM miktarını artırın veya disk üzerinde sanal bellek (Swap) alanı oluşturarak geçici koruma sağlayın. Uygulamadaki bellek sızıntılarını tespit edin.'
      }
    }

    // 4. Connection Refused / 502
    if (lower.includes('connection refused') || lower.includes('could not connect') || lower.includes('connect() failed')) {
      return {
        category: 'Ağ / Bağlantı Reddedildi (502 Bad Gateway)',
        severity: 'error',
        explanation: 'Nginx veya başka bir proxy servisi arkada çalışan uygulamaya bağlanmaya çalıştı, ancak uygulamanın dinlediği port kapalı olduğundan bağlantı reddedildi. Uygulama çalışmıyor olabilir.',
        suggestion: 'Arkada çalışan uygulamanın (örn: PM2 süreci veya systemd servisi) aktif olup olmadığını kontrol edin. Servis kodlarını veya loglarını inceleyin: pm2 status'
      }
    }

    // 5. Disk Full
    if (lower.includes('disk full') || lower.includes('no space left') || lower.includes('write error: disk')) {
      return {
        category: 'Sistem / Disk Doluluk Hatası',
        severity: 'critical',
        explanation: 'Sunucunun disk depolama alanı tamamen dolmuştur. Disk dolduğu için işletim sistemi geçici dosya yazamıyor, veritabanı kilitleniyor ve servisler hata veriyor.',
        suggestion: 'df -h komutu ile disk durumunu inceleyin. Gereksiz logları, docker imajlarını veya cache klasörlerini temizleyerek yer açın. Temizleme komutu: docker system prune -a'
      }
    }

    // 6. PromSSH Debug / Keepalive
    if (lower.includes('latency check') || lower.includes('keepalive') || lower.includes('ping') || lower.includes('pong')) {
      return {
        category: 'PromSSH Canlılık Takibi',
        severity: 'info',
        explanation: 'PromSSH uygulamasının sunucuyla kurduğu SSH tünelinin kopmasını engellemek amacıyla arka planda gönderilen canlılık (ping/keepalive) sinyalidir.',
        suggestion: 'Bu normal bir çalışma logudur. Bağlantının kopmasını önleyen mekanizma devrededir.'
      }
    }

    // 7. Session Started / Closed
    if (lower.includes('started session') || lower.includes('opened session') || lower.includes('closed session')) {
      return {
        category: 'Sistem / Kullanıcı Oturum Başlangıcı',
        severity: 'info',
        explanation: 'Bir kullanıcı sunucuya SSH veya konsol üzerinden başarıyla giriş yaptı ya da bir arka plan görevi (cron vb.) kendi oturumunu başlattı.',
        suggestion: 'İşlemin sizin bilginiz dahilinde yapıldığından emin olun. Giriş yapan kullanıcı adı log satırında belirtilmiştir.'
      }
    }

    // 8. General Errors
    if (lower.includes('error') || lower.includes('fail') || lower.includes('fatal') || lower.includes('warning') || lower.includes('warn')) {
      const isErr = lower.includes('error') || lower.includes('fail') || lower.includes('fatal')
      return {
        category: isErr ? 'Genel Sistem / Uygulama Hatası' : 'Sistem / Uyarı Günlüğü',
        severity: isErr ? 'error' : 'warning',
        explanation: 'Sistem günlüklerinde hata veya uyarı belirten kritik bir kelime saptandı. İlgili servis veya dosya yazma işleminde bir aksama yaşanmış olabilir.',
        suggestion: 'Log satırındaki hata mesajının detayına göre ilgili servisi (Nginx, MySQL, PM2 vb.) yeniden başlatın veya konfigürasyonunu kontrol edin.'
      }
    }

    // Default
    return {
      category: 'Sistem / Genel Olay Günlüğü',
      severity: 'info',
      explanation: 'Sistem veya aktif servisler tarafından üretilen standart durum veya faaliyet bilgilendirme logudur.',
      suggestion: 'Log kaydı normal çalışmaya işaret ediyor. Herhangi bir eylem veya hata düzeltmesi gerekmiyor.'
    }
  }

  // Filter lines based on search query AND Error filtering option
  const filteredLines = logLines.filter((l) => {
    const matchesSearch = searchQuery ? l.toLowerCase().includes(searchQuery.toLowerCase()) : true
    if (!matchesSearch) return false
    
    if (filterErrors) {
      const lower = l.toLowerCase()
      return lower.includes('error') || lower.includes('fail') || lower.includes('warn') || lower.includes('fatal') || lower.includes('critical') || lower.includes('refused') || lower.includes('oom')
    }
    
    return true
  })

  const selectedLineAnalysis = selectedLine ? interpretLogLine(selectedLine) : null

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden select-none transition-colors duration-300">
      {/* Top Bar Controls */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-950 flex items-center justify-between gap-4 shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-3 w-full max-w-3xl">
          <FileText className="text-indigo-500 shrink-0 animate-pulse" size={18} />
          
          {/* Source Dropdown */}
          <select
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-300 shrink-0"
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-205 font-semibold">
                {s.name}
              </option>
            ))}
          </select>

          {/* Search bar */}
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Log satırlarında ara..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Errors Only Filter */}
          <button
            onClick={() => setFilterErrors(!filterErrors)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-205 ${
              filterErrors
                ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
            title="Sadece Hataları ve Uyarıları Göster"
          >
            <Filter size={12} />
            Hata Filtresi
          </button>

          {/* Lines Count Selector */}
          {selectedSource !== 'promssh_debug' && (
            <select
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-350"
              value={linesCount}
              onChange={(e) => setLinesCount(Number(e.target.value))}
            >
              <option value={50} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-205">50 satır</option>
              <option value={100} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-205">100 satır</option>
              <option value={250} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-205">250 satır</option>
              <option value={500} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-205">500 satır</option>
            </select>
          )}

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition disabled:opacity-50"
            title="Yenile"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main split display: Logs terminal left, Analyzer sidebar right */}
      <div className="flex-grow flex-1 flex overflow-hidden">
        
        {/* Left pane: Log Lines Terminal */}
        <div className="flex-grow flex-1 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-900/60 p-4 font-mono text-xs overflow-y-auto text-slate-800 dark:text-slate-305 relative select-text leading-relaxed transition-colors duration-300">
          <div className="space-y-1 pb-16">
            {filteredLines.map((line, idx) => {
              const lower = line.toLowerCase()
              const isError = lower.includes('error') || lower.includes('fail') || lower.includes('refused') || lower.includes('oom') || lower.includes('failed password')
              const isWarning = lower.includes('warn') || lower.includes('ssl_accept() failed')
              const isSelected = selectedLineIndex === idx

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedLine(line)
                    setSelectedLineIndex(idx)
                  }}
                  className={`whitespace-pre-wrap cursor-pointer px-2 py-0.5 rounded transition-all duration-150 ${
                    isSelected
                      ? 'bg-indigo-500/20 dark:bg-indigo-600/40 text-slate-900 dark:text-white font-bold border-l-2 border-indigo-500 pl-1.5'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-100 border-l-2 border-transparent'
                  } ${
                    isError 
                      ? 'text-red-650 dark:text-red-400 font-medium' 
                      : isWarning 
                      ? 'text-amber-600 dark:text-yellow-400' 
                      : 'text-slate-700 dark:text-slate-350'
                  }`}
                  title="Detaylı Teşhis Analizi İçin Tıkla"
                >
                  <span className="text-slate-400 dark:text-slate-700 mr-2.5 select-none font-bold">
                    {idx + 1}.
                  </span>
                  {line}
                </div>
              )
            })}
            <div ref={logEndRef} />
          </div>

          {/* Scroll bottom helper */}
          <button
            onClick={handleScrollToBottom}
            className="absolute right-6 bottom-6 p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
            title="En Alta Git"
          >
            <ArrowDown size={16} />
          </button>
        </div>

        {/* Right pane: Sliding Log Interpreter Detail Sidebar */}
        <div className="w-[420px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col shrink-0 transition-colors duration-300">
          <div className="flex flex-col h-full overflow-hidden select-none">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-slate-150 dark:border-slate-900 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <Sparkles size={14} className="animate-pulse" />
                AKILLI LOG YORUMLAYICI
              </span>
              {selectedLine && (
                <button
                  onClick={() => {
                    setSelectedLine(null)
                    setSelectedLineIndex(null)
                  }}
                  className="px-2 py-1 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-md text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  Kılavuza Dön
                </button>
              )}
            </div>

            {/* Sidebar Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 flex flex-col">
              {selectedLine && selectedLineAnalysis ? (
                /* --- 1. SELECTED LOG DETAIL DIAGNOSIS --- */
                <div className="space-y-5 flex-1 text-left">
                  
                  {/* Status/Category Header */}
                  <div className={`p-4 rounded-xl border flex flex-col gap-1.5 ${
                    selectedLineAnalysis.severity === 'critical'
                      ? 'bg-red-500/10 border-red-500/30 text-red-650 dark:text-red-405'
                      : selectedLineAnalysis.severity === 'error'
                      ? 'bg-red-500/5 border-red-500/20 text-red-500'
                      : selectedLineAnalysis.severity === 'warning'
                      ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-605 dark:text-yellow-405'
                      : 'bg-indigo-500/5 border-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      {selectedLineAnalysis.severity === 'critical' || selectedLineAnalysis.severity === 'error' ? (
                        <ShieldAlert size={16} className="shrink-0" />
                      ) : selectedLineAnalysis.severity === 'warning' ? (
                        <ShieldAlert size={16} className="shrink-0 text-yellow-500" />
                      ) : (
                        <Info size={16} className="shrink-0 text-indigo-500" />
                      )}
                      <h4 className="font-extrabold text-xs uppercase tracking-wide">
                        {selectedLineAnalysis.category}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                      Önem Derecesi: {selectedLineAnalysis.severity}
                    </span>
                  </div>

                  {/* Log Line raw snippet */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                      SEÇİLEN LOG SATIRI
                    </span>
                    <div className="p-3.5 rounded-lg bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-900 text-[11px] font-mono text-slate-800 dark:text-slate-300 select-text whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                      {selectedLine}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                      NEDEN OLDU? (AÇIKLAMA)
                    </span>
                    <p className="text-xs font-semibold leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-lg border border-slate-200/50 dark:border-slate-800/40">
                      {selectedLineAnalysis.explanation}
                    </p>
                  </div>

                  {/* Resolution / Suggestion */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-150 dark:border-slate-900">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                      ÇÖZÜM ÖNERİSİ & ÇÖZÜM KOMUTLARI
                    </span>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-850">
                      <pre className="text-xs font-semibold leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-mono select-text bg-slate-100 dark:bg-slate-900 p-3 rounded border border-slate-200/80 dark:border-slate-800/40 text-left max-h-56 overflow-y-auto">
                        {selectedLineAnalysis.suggestion}
                      </pre>
                    </div>
                  </div>



                </div>
              ) : (
                /* --- 2. COMMON ERRORS REFERENCE GUIDE (HANDBOOK) --- */
                <div className="space-y-4 flex-1 text-left">
                  <div className="pb-2 text-left border-b border-slate-100 dark:border-slate-900">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Info size={14} className="text-indigo-500" />
                      SIK KARŞILAŞILAN HATA REHBERİ
                    </h4>
                    <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500 mt-1">
                      Sol taraftaki terminalden herhangi bir log satırına tıklayarak anında akıllı çözüm önerisi alabilirsin. Veya aşağıdaki örnek hatalardan birini seçip çözümünü inceleyebilirsin:
                    </p>
                  </div>

                  <div className="space-y-3">
                    {COMMON_ERRORS_GUIDE.map((err, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedLine(err.code)
                          setSelectedLineIndex(null) // guide is not in index
                        }}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/80 cursor-pointer transition-all duration-200 text-left hover:border-indigo-500/30 group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
                            {err.title}
                          </span>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${
                            err.severity === 'critical' ? 'bg-red-500/10 text-red-500' :
                            err.severity === 'error' ? 'bg-red-500/10 text-red-400' :
                            err.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                            'bg-indigo-500/10 text-indigo-500'
                          }`}>
                            {err.severity}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate bg-slate-950/5 dark:bg-slate-955/20 px-1.5 py-0.5 rounded border border-slate-200/5 dark:border-slate-800/10">
                          {err.code}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Help Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 mt-4 text-left">
                    <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      💡 Teşhis İpucu
                    </h5>
                    <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 mt-1">
                      Log filtrelemeyi açarak sadece hata ve uyarı (error, fail, warning) içeren satırları görebilir ve analiz etmek için tıklayabilirsin.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
