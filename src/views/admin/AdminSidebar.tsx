import React from 'react';
import { ExternalLink, type LucideIcon } from 'lucide-react';
import { buildViewUrl } from '../../lan/roomCode';
import { ADMIN_FOCUS, AdminModuleId } from './adminMeta';

export interface AdminNavItem {
  id: AdminModuleId;
  Icon: LucideIcon;
  labelPt: string;
  labelEn: string;
}

interface AdminSidebarProps {
  isPt: boolean;
  activeModule: AdminModuleId;
  navItems: AdminNavItem[];
  roomCode?: string | null;
  onSelectModule: (id: AdminModuleId) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isPt,
  activeModule,
  navItems,
  roomCode,
  onSelectModule,
}) => {
  return (
    <aside className="flex shrink-0 flex-row gap-1.5 overflow-x-auto border-b border-[#1e3a66]/55 bg-[#040b1a] p-2.5 lg:w-56 lg:flex-col lg:justify-between lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-3">
      <nav aria-label="Show Control Modules" className="flex flex-row gap-1 lg:flex-col">
        {navItems.map(({ id, Icon, labelPt, labelEn }) => {
          const active = activeModule === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectModule(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[42px] shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition ${ADMIN_FOCUS} ${
                active
                  ? 'border border-[#2563eb]/55 bg-[#0c1a36] font-semibold text-white'
                  : 'border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              }`}
            >
              <Icon size={15} className={active ? 'text-[#7dd3fc]' : 'text-slate-400'} />
              <span>{isPt ? labelPt : labelEn}</span>
            </button>
          );
        })}
      </nav>

      {/* Atalho externo exclusivo da barra lateral */}
      <div className="hidden flex-col gap-1.5 border-t border-[#1e3a66]/45 pt-3 lg:flex">
        <a
          href={buildViewUrl(null, 'demo', { roomCode })}
          target="_blank"
          rel="noreferrer"
          className={`flex min-h-[40px] items-center justify-between rounded-xl border border-[#1e3a66]/65 bg-[#060c1a] px-3 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
        >
          <span>{isPt ? 'Demo · Sala + Tablet' : 'Demo · Room + Tablet'}</span>
          <ExternalLink size={12} className="text-slate-400" />
        </a>
      </div>
    </aside>
  );
};
