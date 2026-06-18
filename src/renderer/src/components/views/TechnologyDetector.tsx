import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, RefreshCw, Layers } from 'lucide-react'

interface TechnologyDetectorProps {
  connectionId: number | string
  onScanComplete?: (dockerInstalled: boolean, pm2Installed: boolean) => void
}

interface TechStatus {
  key: string
  name: string
  category: 'Runtime' | 'Package Manager' | 'Database' | 'Tool' | 'Web Server'
  installed: boolean
  version: string
}

export const TechnologyDetector: React.FC<TechnologyDetectorProps> = ({
  connectionId,
  onScanComplete
}) => {
  const [techs, setTechs] = useState<TechStatus[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const techDefs = [
    { key: 'node', name: 'Node.js', category: 'Runtime' as const },
    { key: 'npm', name: 'npm', category: 'Package Manager' as const },
    { key: 'pnpm', name: 'pnpm', category: 'Package Manager' as const },
    { key: 'yarn', name: 'yarn', category: 'Package Manager' as const },
    { key: 'php', name: 'PHP', category: 'Runtime' as const },
    { key: 'composer', name: 'Composer', category: 'Package Manager' as const },
    { key: 'python', name: 'Python', category: 'Runtime' as const },
    { key: 'pip', name: 'pip', category: 'Package Manager' as const },
    { key: 'java', name: 'Java', category: 'Runtime' as const },
    { key: 'maven', name: 'Maven', category: 'Package Manager' as const },
    { key: 'gradle', name: 'Gradle', category: 'Package Manager' as const },
    { key: 'dotnet', name: '.NET', category: 'Runtime' as const },
    { key: 'go', name: 'Go', category: 'Runtime' as const },
    { key: 'rust', name: 'Rust', category: 'Runtime' as const },
    { key: 'docker', name: 'Docker', category: 'Tool' as const },
    { key: 'dockercompose', name: 'Docker Compose', category: 'Tool' as const },
    { key: 'redis', name: 'Redis', category: 'Database' as const },
    { key: 'postgresql', name: 'PostgreSQL', category: 'Database' as const },
    { key: 'mysql', name: 'MySQL', category: 'Database' as const },
    { key: 'mongodb', name: 'MongoDB', category: 'Database' as const },
    { key: 'git', name: 'Git', category: 'Tool' as const },
    { key: 'nginx', name: 'Nginx', category: 'Web Server' as const },
    { key: 'apache', name: 'Apache', category: 'Web Server' as const },
    { key: 'pm2', name: 'PM2', category: 'Tool' as const }
  ]

  useEffect(() => {
    scanTechnologies()
  }, [connectionId])

  const scanTechnologies = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const script = `
        check_cmd() {
          if command -v "$1" >/dev/null 2>&1; then
            echo "installed"
            eval "$2" 2>&1 | head -n 1
          else
            echo "missing"
            echo ""
          fi
        }

        echo "===node==="; check_cmd "node" "node -v"
        echo "===npm==="; check_cmd "npm" "npm -v"
        echo "===pnpm==="; check_cmd "pnpm" "pnpm -v"
        echo "===yarn==="; check_cmd "yarn" "yarn -v"
        echo "===php==="; check_cmd "php" "php -v"
        echo "===composer==="; check_cmd "composer" "composer -V"
        echo "===python==="; check_cmd "python3" "python3 --version" || check_cmd "python" "python --version"
        echo "===pip==="; check_cmd "pip3" "pip3 --version" || check_cmd "pip" "pip --version"
        echo "===java==="; check_cmd "java" "java -version"
        echo "===maven==="; check_cmd "mvn" "mvn -v"
        echo "===gradle==="; check_cmd "gradle" "gradle -v"
        echo "===dotnet==="; check_cmd "dotnet" "dotnet --version"
        echo "===go==="; check_cmd "go" "go version"
        echo "===rust==="; check_cmd "rustc" "rustc --version"
        echo "===docker==="; check_cmd "docker" "docker -v"
        echo "===dockercompose==="; check_cmd "docker-compose" "docker-compose -v" || check_cmd "docker" "docker compose version"
        echo "===redis==="; check_cmd "redis-server" "redis-server -v"
        echo "===postgresql==="; check_cmd "psql" "psql --version"
        echo "===mysql==="; check_cmd "mysql" "mysql --version"
        echo "===mongodb==="; check_cmd "mongod" "mongod --version"
        echo "===git==="; check_cmd "git" "git --version"
        echo "===nginx==="; check_cmd "nginx" "nginx -v"
        echo "===apache==="; check_cmd "apache2" "apache2 -v" || check_cmd "httpd" "httpd -v"
        echo "===pm2==="; check_cmd "pm2" "pm2 -v"
      `
      const res = await window.api.sshExec(connectionId, script)
      if (res.error) {
        setError(res.error)
      } else {
        const results = parseScanOutput(res.stdout)
        setTechs(results)

        // Notify parent about critical services (Docker and PM2)
        const docker = results.find((r) => r.key === 'docker')?.installed || false
        const pm2 = results.find((r) => r.key === 'pm2')?.installed || false
        if (onScanComplete) {
          onScanComplete(docker, pm2)
        }
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const parseScanOutput = (stdout: string): TechStatus[] => {
    const lines = stdout.split('\n')
    const results: TechStatus[] = []

    let currentKey = ''
    let isInstalled = false
    let versionRaw = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith('===')) {
        // Save previous if any
        if (currentKey) {
          saveResult(results, currentKey, isInstalled, versionRaw)
        }
        currentKey = line.replace(/===/g, '')
        isInstalled = false
        versionRaw = ''
      } else if (line === 'installed') {
        isInstalled = true
      } else if (line === 'missing') {
        isInstalled = false
      } else if (line !== '' && isInstalled) {
        versionRaw = line
      }
    }
    // Save last
    if (currentKey) {
      saveResult(results, currentKey, isInstalled, versionRaw)
    }

    return results
  }

  const saveResult = (results: TechStatus[], key: string, installed: boolean, version: string): void => {
    const def = techDefs.find((t) => t.key === key)
    if (def) {
      let cleanedVersion = version
      // Clean up common version headers
      if (key === 'node') cleanedVersion = version.startsWith('v') ? version : `v${version}`
      if (key === 'java' && version.includes('version')) {
        // e.g. openjdk version "17.0.2"
        const match = version.match(/"([^"]+)"/)
        if (match) cleanedVersion = match[1]
      }
      if (key === 'python' && version.startsWith('Python ')) cleanedVersion = version.replace('Python ', '')
      if (key === 'docker' && version.includes('version')) {
        // e.g. Docker version 20.10.12, build e91ed57
        const match = version.match(/version ([^,]+)/)
        if (match) cleanedVersion = match[1]
      }
      if (key === 'nginx' && version.includes('/')) {
        // e.g. nginx version: nginx/1.18.0
        cleanedVersion = version.split('/').pop() || version
      }
      if (key === 'git') {
        cleanedVersion = version.replace('git version ', '')
      }
      if (key === 'postgresql') {
        const match = version.match(/psql \(PostgreSQL\) ([^\s]+)/)
        if (match) cleanedVersion = match[1]
      }

      results.push({
        key,
        name: def.name,
        category: def.category,
        installed,
        version: cleanedVersion || 'Kurulu'
      })
    }
  }

  const handleManualRefresh = async (): Promise<void> => {
    setRefreshing(true)
    await scanTechnologies()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-slate-500">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <span className="text-sm font-semibold">Kurulu teknolojiler taranıyor...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 text-red-500">
        <h3 className="text-lg font-bold mb-2">Tarama Hatası</h3>
        <p className="text-sm max-w-lg text-center leading-relaxed text-slate-500 dark:text-slate-400 mb-6">
          {error}
        </p>
        <button
          onClick={scanTechnologies}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-550 text-white transition"
        >
          Yeniden Dene
        </button>
      </div>
    )
  }

  const categories = ['Runtime', 'Package Manager', 'Database', 'Web Server', 'Tool'] as const

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-8 select-none">
      {/* Title / Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teknoloji Dedektörü</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Sunucuda kurulu olan diller, veri tabanları, paket yöneticileri ve sunucu yazılımları.
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          className={`p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition ${
            refreshing ? 'animate-spin' : ''
          }`}
          title="Yenile"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Categories block */}
      {categories.map((category) => {
        const catTechs = techs.filter((t) => t.category === category)
        if (catTechs.length === 0) return null

        return (
          <div key={category} className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <Layers size={14} />
              {category === 'Runtime'
                ? 'Çalışma Ortamları & Diller'
                : category === 'Package Manager'
                ? 'Paket Yöneticileri'
                : category === 'Database'
                ? 'Veri Tabanları'
                : category === 'Web Server'
                ? 'Web Sunucuları'
                : 'Araçlar & Servisler'}
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {catTechs.map((t) => (
                <div
                  key={t.key}
                  className={`p-4 rounded-xl border bg-white dark:bg-slate-950 flex items-center justify-between transition ${
                    t.installed
                      ? 'border-green-500/20 shadow-sm shadow-green-500/5'
                      : 'border-slate-250 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm truncate">{t.name}</h4>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                      {t.installed ? t.version : 'Mevcut Değil'}
                    </span>
                  </div>

                  <div className="shrink-0 ml-3">
                    {t.installed ? (
                      <CheckCircle className="text-green-500" size={20} />
                    ) : (
                      <XCircle className="text-slate-300 dark:text-slate-700" size={20} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
