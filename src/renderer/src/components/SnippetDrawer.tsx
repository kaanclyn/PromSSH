import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, Terminal, Cpu, Database, Settings, Sparkles, Shield, Search, Copy, Check, Layers } from 'lucide-react'

interface Snippet {
  id: string
  name: string
  command: string
  description: string
  category: 'System' | 'Docker' | 'Nginx' | 'PM2' | 'Security'
}

interface SnippetDrawerProps {
  isOpen: boolean
  onClose: () => void
  connectionId: number | string
}

export const SnippetDrawer: React.FC<SnippetDrawerProps> = ({ isOpen, onClose, connectionId }) => {
  const [runningSnippet, setRunningSnippet] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  const snippets: Snippet[] = [
    {
      id: 'nginx_test',
      name: 'Nginx Konfigürasyon Testi',
      command: 'nginx -t',
      description: 'Nginx ayarlarında sözdizimi (syntax) hatası olup olmadığını denetler ve yapılandırma dosyasının yerini doğrular.',
      category: 'Nginx'
    },
    {
      id: 'nginx_reload',
      name: 'Nginx Yeniden Yükle (Reload)',
      command: 'sudo nginx -s reload || nginx -s reload || sudo systemctl reload nginx || systemctl reload nginx',
      description: 'Nginx web sunucusunu aktif bağlantıları koparmadan yeni ayarlarla güvenle tetikler.',
      category: 'Nginx'
    },
    {
      id: 'nginx_last_errors',
      name: 'Nginx Son 20 Hata Logu',
      command: 'tail -n 20 /var/log/nginx/error.log 2>/dev/null || cat /var/log/nginx/error.log | tail -n 20 2>/dev/null || echo "Log dosyası okunamadı veya Nginx varsayılan log yolunda değil."',
      description: 'Nginx web sunucusunun ürettiği en son 20 hata günlüğünü ve kritik çökmeleri görüntüler.',
      category: 'Nginx'
    },
    {
      id: 'docker_prune',
      name: 'Docker Çöp Temizliği (Prune)',
      command: 'docker system prune -a --volumes -f',
      description: 'Kullanılmayan durdurulmuş konteynerleri, ağları, askıda kalan image dosyalarını ve cache birimlerini tamamen siler.',
      category: 'Docker'
    },
    {
      id: 'docker_disk',
      name: 'Docker Disk Kullanımı (df)',
      command: 'docker system df',
      description: 'Docker dosyalarının diskte ne kadar yer kapladığını (image, container, volume) listeler.',
      category: 'Docker'
    },
    {
      id: 'docker_ps',
      name: 'Tüm Konteynerleri Detaylı Listele',
      command: 'docker ps -a --format "table {{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.RunningFor}}\\t{{.Ports}}"',
      description: 'Sunucudaki aktif, durdurulmuş tüm Docker konteynerlerini isim, çalışma süresi ve port detaylarıyla listeler.',
      category: 'Docker'
    },
    {
      id: 'pm2_list',
      name: 'PM2 Süreç Listesi',
      command: 'pm2 list',
      description: 'PM2 altındaki tüm Node.js uygulamalarını, id, mod ve çalışma durumlarını listeler.',
      category: 'PM2'
    },
    {
      id: 'pm2_monit',
      name: 'PM2 Canlı CPU/RAM İzleme',
      command: 'pm2 status && pm2 desc 0 2>/dev/null || pm2 status',
      description: 'PM2 süreçlerinin anlık CPU, bellek durumlarını ve ayrıntılı log çıktı yollarını detaylandırır.',
      category: 'PM2'
    },
    {
      id: 'pm2_last_logs',
      name: 'PM2 Son 50 Log Kaydı',
      command: 'pm2 logs --lines 50 --raw --nostream 2>/dev/null || echo "PM2 süreci bulunamadı."',
      description: 'PM2 ile yönetilen uygulamaların ürettiği son 50 satırlık birleşik hata ve çıktı logunu anında çeker.',
      category: 'PM2'
    },
    {
      id: 'sys_ports',
      name: 'Dinlenen Ağ Portları',
      command: 'ss -tulpn || netstat -tulpn || lsof -i -P -n | grep LISTEN',
      description: 'Aktif olarak ağ isteklerini dinleyen servisleri, PID numaralarını ve kullanılan TCP/UDP portlarını listeler.',
      category: 'System'
    },
    {
      id: 'sys_cpu_process',
      name: 'En Yoğun 10 CPU Süreci',
      command: 'ps aux --sort=-%cpu | head -n 11',
      description: 'Sunucu işlemcisini (CPU) en çok meşgul eden ilk 10 arka plan sürecini ve sahiplerini listeler.',
      category: 'System'
    },
    {
      id: 'sys_ram_process',
      name: 'En Yoğun 10 RAM Süreci',
      command: 'ps aux --sort=-%mem | head -n 11',
      description: 'Sunucu fiziksel belleğini (RAM) en çok tüketen ilk 10 arka plan sürecini ve sahiplerini listeler.',
      category: 'System'
    },
    {
      id: 'sys_disk_heavy',
      name: 'En Çok Yer Kaplayan 10 Klasör',
      command: 'sudo du -hs /* 2>/dev/null | sort -rh | head -n 10 || du -hs /* 2>/dev/null | sort -rh | head -n 10',
      description: 'Kök dizinden başlayarak disk alanını en çok harcayan ilk 10 ana klasörü boyutlarıyla listeler.',
      category: 'System'
    },
    {
      id: 'sys_disk',
      name: 'Detaylı Disk Alanı (df)',
      command: 'df -hT',
      description: 'Disk bölümlerinin doluluk oranını, dosya sistem tiplerini ve boş alan boyutlarını listeler.',
      category: 'System'
    },
    {
      id: 'sys_ram',
      name: 'Bellek ve Swap Tüketimi',
      command: 'free -h',
      description: 'Sunucu RAM ve sanal bellek (Swap) tüketim durumunu insan dostu formatta gösterir.',
      category: 'System'
    },
    {
      id: 'sys_uptime',
      name: 'Çalışma Süresi & Ortalama Yük',
      command: 'uptime',
      description: 'Sunucunun ne kadar süredir açık kaldığını ve son 1, 5 ve 15 dakikalık ortalama CPU yükünü verir.',
      category: 'System'
    },
    {
      id: 'sys_cpu_info',
      name: 'CPU Sıcaklığı & İşlemci Modeli',
      command: 'lscpu | grep -E "Model name|Core\\(s\\) per socket|Socket\\(s\\)|Thread\\(s\\) per core" && (cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk \'{print "İşlemci Sıcaklığı: "$1/1000"°C"}\' || echo "Isı sensörü okunamadı.")',
      description: 'İşlemci donanım modelini, çekirdek mimarisini ve eğer destekleniyorsa anlık işlemci sıcaklığını raporlar.',
      category: 'System'
    },
    {
      id: 'sys_ram_flush',
      name: 'Sistem Önbelleğini Temizle (RAM Boşalt)',
      command: 'sync && (sudo echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null && echo "Önbellek temizlendi!") || echo "Yetki yetersiz. Sudo şifresi gereklidir."',
      description: 'Sunucu belleğinde biriken gereksiz disk okuma önbelleğini (cached memory) güvenle boşaltarak RAM temizliği yapar.',
      category: 'System'
    },
    {
      id: 'sec_fail2ban',
      name: 'Fail2ban SSH Engelli IP Listesi',
      command: 'sudo fail2ban-client status sshd 2>/dev/null || fail2ban-client status sshd 2>/dev/null || echo "Fail2ban aktif değil veya yetki yetersiz (sudo yetkisi gerekebilir)."',
      description: 'Fail2ban güvenlik aracı tarafından SSH portunda bloklanmış olan şüpheli IP adreslerinin güncel listesini ve durumunu gösterir.',
      category: 'Security'
    },
    {
      id: 'sec_ufw',
      name: 'UFW Güvenlik Duvarı Kuralları',
      command: 'sudo ufw status numbered 2>/dev/null || ufw status 2>/dev/null || echo "UFW aktif değil veya yetki yetersiz."',
      description: 'Sistem güvenlik duvarının (ufw) aktif olan tüm kurallarını numaralı ve detaylı olarak listeler.',
      category: 'Security'
    },
    {
      id: 'sec_logins',
      name: 'SSH Oturum Giriş Geçmişi',
      command: 'last -a -n 20 | head -n 20',
      description: 'Sunucuya son zamanlarda giriş yapmış en son 20 SSH/sistem oturumunu, kullanıcı adlarını ve IP adreslerini listeler.',
      category: 'Security'
    },
    {
      id: 'sec_auth_fails',
      name: 'Son 15 Başarısız Giriş Logu',
      command: 'grep "Failed password" /var/log/auth.log /var/log/secure 2>/dev/null | tail -n 15 || journalctl _SYSTEMD_UNIT=ssh.service | grep "Failed" | tail -n 15 2>/dev/null || echo "Hatalı giriş kaydı bulunamadı."',
      description: 'Sistem günlüklerinde yer alan son 15 başarısız parola giriş denemesini ve hedef kullanıcı adlarını raporlar.',
      category: 'Security'
    }
  ]

  const categories = ['All', 'System', 'Nginx', 'Docker', 'PM2', 'Security']

  const handleRun = async (snippet: Snippet): Promise<void> => {
    setRunningSnippet(snippet.name)
    setOutput('Komut çalıştırılıyor...\n$ ' + snippet.command + '\n\n')
    setIsRunning(true)
    try {
      const res = await window.api.sshExec(connectionId, snippet.command)
      if (res.error) {
        setOutput((prev) => prev + '❌ Hata oluştu:\n' + res.error)
      } else {
        setOutput((prev) => prev + '✓ Çıktı:\n' + (res.stdout || '') + (res.stderr ? '\nHatalar:\n' + res.stderr : ''))
      }
    } catch (e: any) {
      setOutput((prev) => prev + '❌ Beklenmeyen Hata: ' + e.message)
    } finally {
      setIsRunning(false)
    }
  }

  const handleCopy = (snippet: Snippet): void => {
    window.api.clipboardWriteText(snippet.command)
    setCopiedId(snippet.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getCategoryIcon = (category: string): React.ReactNode => {
    switch (category) {
      case 'Docker':
        return <Database size={16} />
      case 'Nginx':
        return <Settings size={16} />
      case 'PM2':
        return <Cpu size={16} />
      case 'Security':
        return <Shield size={16} />
      default:
        return <Terminal size={16} />
    }
  }

  // Filter snippets by search query and selected category
  const filteredSnippets = snippets.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.command.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-30 flex justify-end bg-black/20 dark:bg-black/50 backdrop-blur-[2px]">
          {/* Dismiss Click Area */}
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ x: '100%', opacity: 0.95 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full sm:w-[560px] md:w-[680px] lg:w-[820px] h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 text-slate-900 dark:text-slate-100 transition-colors duration-300"
          >
            {/* Top border line */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-indigo-500/40" />

            {/* Header */}
            <div className="p-6 border-b border-slate-150 dark:border-slate-850 flex items-center justify-between shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-500 dark:text-indigo-400" />
                  Hızlı Snippet Deposu
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium truncate">
                  Sunucunda en çok çalıştırılan komutları anında çalıştır, kopyala ve analiz et.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450 hover:text-slate-650 dark:hover:text-slate-200 transition shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter and Search Bar (Modular UI) */}
            <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-150 dark:border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
              {/* Category tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                        : 'text-slate-550 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {cat === 'All' ? 'Tümü' : cat === 'Security' ? 'Güvenlik' : cat === 'System' ? 'Sistem' : cat}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Komut veya açıklama ara..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Main content grid */}
            <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-6">
              
              {/* Snippet List Container */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-left">
                {filteredSnippets.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                    <Layers size={36} className="mb-2 opacity-50" />
                    <span className="text-xs font-semibold">Filtre kriterlerine uygun komut bulunamadı.</span>
                  </div>
                ) : (
                  filteredSnippets.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/40 hover:border-indigo-500/40 hover:bg-white dark:hover:bg-slate-900/80 transition-all duration-200 flex flex-col gap-3.5 group shadow-sm hover:shadow"
                    >
                      {/* Top Info & Buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="p-1.5 rounded-md bg-slate-200 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 shrink-0">
                              {getCategoryIcon(s.category)}
                            </span>
                            <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">
                              {s.name}
                            </h4>
                            <span className="text-[8px] font-black tracking-widest px-2 py-0.5 rounded bg-slate-200/50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase shrink-0">
                              {s.category === 'Security' ? 'Güvenlik' : s.category === 'System' ? 'Sistem' : s.category}
                            </span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed font-semibold">
                            {s.description}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                          {/* Copy Button */}
                          <button
                            onClick={() => handleCopy(s)}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition duration-150 relative"
                            title="Komutu Kopyala"
                          >
                            {copiedId === s.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                          </button>

                          {/* Run Button */}
                          <button
                            onClick={() => handleRun(s)}
                            disabled={isRunning}
                            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                          >
                            <Play size={10} fill="currentColor" />
                            Çalıştır
                          </button>
                        </div>
                      </div>

                      {/* Display Command (Professional Look) */}
                      <div className="relative">
                        <pre className="p-3 rounded-xl bg-slate-950 border border-slate-900 text-[10px] font-mono text-slate-400 dark:text-slate-400 overflow-x-auto select-text leading-relaxed whitespace-pre-wrap break-all text-left">
                          $ {s.command}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Output terminal display (Wider & Legible Output) */}
              <div className="h-64 rounded-2xl bg-slate-950 border border-slate-900 p-4 font-mono text-[11px] flex flex-col overflow-hidden relative shadow-inner text-slate-300 shrink-0">
                <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-900/60 mb-2 shrink-0">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <Terminal size={12} />
                    Terminal Çıktısı
                  </span>
                  {runningSnippet && (
                    <span className="text-[10px] text-indigo-400 font-bold animate-pulse">
                      Çalışıyor: {runningSnippet}
                    </span>
                  )}
                </div>
                <div className="flex-grow overflow-y-auto whitespace-pre-wrap select-text text-slate-300 leading-relaxed pr-1 text-left scrollbar-thin scrollbar-thumb-slate-800">
                  {output || 'Tetiklenen snippet sonuçları burada canlı olarak belirecektir.'}
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
