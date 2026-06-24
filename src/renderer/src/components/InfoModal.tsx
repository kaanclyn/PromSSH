import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Globe, Mail, Landmark, ShieldCheck } from 'lucide-react'
import logo from '../assets/logo.png'

interface InfoModalProps {
  isOpen: boolean
  onClose: () => void
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-md p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 shadow-2xl text-slate-900 dark:text-slate-100 relative overflow-hidden"
        >
          {/* Decorative Glowing Header Line */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-indigo-500" />

          {/* Modal Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <img src={logo} className="w-6 h-6 object-contain" alt="PROMHUB" />
              <span className="text-sm font-black tracking-wide text-slate-900 dark:text-white uppercase">
                Uygulama Bilgisi
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Content */}
          <div className="space-y-6 text-sm leading-relaxed text-slate-650 dark:text-slate-350">
            {/* Logo and Version */}
            <div className="flex flex-col items-center text-center py-2">
              <div className="relative mb-3">
                <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-xl opacity-60" />
                <img src={logo} className="relative w-20 h-20 object-contain select-none" alt="PROMHUB Logo" />
              </div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                PROMHUB v1.0.0
              </h4>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-widest mt-1">
                Gelişmiş Sunucu Workspace & Kontrol Paneli
              </p>
            </div>

            {/* About Text */}
            <div className="space-y-3">
              <h5 className="font-bold text-slate-850 dark:text-slate-100 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                <Landmark size={13} className="text-indigo-500" />
                Geliştirici & Lisans
              </h5>
              <p className="text-xs">
                PromHub; sunucu yönetim süreçlerini kolaylaştırmak, terminal erişimini görselleştirmek ve veritabanı kontrollü dosya gezginini tek bir çatı altında birleştirmek amacıyla <strong>PromSoftware</strong> tarafından geliştirilmiş yerel (local-first) bir araçtır.
              </p>
              <p className="text-xs">
                Uygulama hem bireysel hem de ticari kullanım senaryoları için tamamen serbesttir ve herhangi bir kullanım kısıtlaması içermez.
              </p>
            </div>

            {/* Privacy Highlight */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850/80 space-y-2">
              <h6 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                <ShieldCheck size={13} className="text-indigo-500" />
                %100 Yerel Veri Güvenliği
              </h6>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Uygulamadaki tüm SSH şifreleri, port bilgileri ve özel anahtarlar yerel cihazınızdaki SQLite veritabanında AES-256 standardı ile şifrelenir. Hiçbir veriniz üçüncü şahıslara veya uzak sunucularımıza gönderilmez.
              </p>
            </div>

            {/* Links and Contact */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
              <a
                href="https://promsoftware.com.tr/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-850"
              >
                <Globe size={13} className="text-slate-400" />
                <span>Web Sitesi:</span>
                <span className="ml-auto font-mono text-[11px]">promsoftware.com.tr</span>
              </a>
              <a
                href="mailto:destek@promsoftware.com.tr"
                className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-850"
              >
                <Mail size={13} className="text-slate-400" />
                <span>Destek E-postası:</span>
                <span className="ml-auto font-mono text-[11px]">destek@promsoftware.com.tr</span>
              </a>
            </div>

            {/* Copyright */}
            <div className="text-center text-[9px] text-slate-400 dark:text-slate-500 pt-2">
              © 2026 PromSoftware. Tüm hakları saklıdır.
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
