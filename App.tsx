
import React, { useState, useEffect } from 'react';
import { AppTab, ProcurementRecord } from './types';
import TodayView from './components/TodayView';
import ProcureView from './components/ProcureView';
import SummaryView from './components/SummaryView';
import { ShoppingBag, ListOrdered, BarChart3, Settings as SettingsIcon, Plus, X, MessageSquare, Clipboard } from 'lucide-react';
import html2canvas from 'html2canvas';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.PROCURE);
  const [records, setRecords] = useState<ProcurementRecord[]>([]);
  const [currentSupplier, setCurrentSupplier] = useState('');
  const [presetColors, setPresetColors] = useState<string[]>(['黑色', '白色', '灰色', '杏色', '-1', '-2', '-3', '-4', '-5', '-6']);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [targetGroupName, setTargetGroupName] = useState('');
  const [newColorInput, setNewColorInput] = useState('');
  
  // 正在编辑的历史记录
  const [editingRecord, setEditingRecord] = useState<ProcurementRecord | null>(null);
  
  useEffect(() => {
    const saved = localStorage.getItem('procurement_records');
    const savedSupplier = localStorage.getItem('last_supplier');
    const savedColors = localStorage.getItem('preset_colors');
    const savedWebhook = localStorage.getItem('wechat_webhook');
    const savedGroupName = localStorage.getItem('target_group_name');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved records", e);
      }
    }
    if (savedSupplier) setCurrentSupplier(savedSupplier);
    if (savedColors) setPresetColors(JSON.parse(savedColors));
    if (savedWebhook) setWebhookUrl(savedWebhook);
    if (savedGroupName) setTargetGroupName(savedGroupName);
  }, []);

  useEffect(() => {
    localStorage.setItem('procurement_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('last_supplier', currentSupplier);
  }, [currentSupplier]);

  useEffect(() => {
    localStorage.setItem('preset_colors', JSON.stringify(presetColors));
  }, [presetColors]);

  useEffect(() => {
    localStorage.setItem('wechat_webhook', webhookUrl);
    localStorage.setItem('target_group_name', targetGroupName);
  }, [webhookUrl, targetGroupName]);

  const generateAndSendImage = async (record: ProcurementRecord) => {
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-10000px';
    tempDiv.style.top = '0';
    document.body.appendChild(tempDiv);

    const formatColor = (s: string) => s.split(/[ ,，、]+/).filter(Boolean).map(c => `-${c}`).join(' ');
    const stores = Array.from({length: 20}, (_, i) => i + 1)
      .filter(id => record.allocations.some(a => a.storeId === id))
      .map(id => `${id}/`)
      .join(' ');

    tempDiv.innerHTML = `
      <div style="width: 600px; background: white; display: flex; flex-direction: column; font-family: sans-serif;">
        <div style="width: 100%; height: 850px; overflow: hidden;">
          <img src="${record.image}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div style="padding: 40px; padding-top: 32px; padding-bottom: 64px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 24px;">
            <div style="display: flex; align-items: baseline; gap: 24px;">
              <span style="font-size: 72px; font-weight: 900; color: #09090b; letter-spacing: -0.05em; line-height: 1;">${record.model}</span>
              <span style="font-size: 30px; font-weight: 500; color: #18181b;">${formatColor(record.color)}</span>
            </div>
            <span style="font-size: 30px; font-weight: 900; color: #18181b;">${record.supplier}</span>
          </div>
          <div style="font-size: 60px; font-weight: 900; color: #09090b; line-height: 1; margin-bottom: 16px;">
            ${record.costPrice} / ${record.sellPrice}
          </div>
          <div style="padding-top: 16px;">
            <div style="font-size: 30px; font-weight: 500; color: #09090b; line-height: 1.2;">
              ${stores}
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      const canvas = await html2canvas(tempDiv, { useCORS: true, scale: 2 });
      document.body.removeChild(tempDiv);
      
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      const file = new File([blob], `采购_${record.supplier}_${record.model}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: '采购单',
            text: targetGroupName ? `发送至: ${targetGroupName}` : '新采购项'
          });
        } catch (shareErr) {
          console.warn("Share failed, falling back to download", shareErr);
          const link = document.createElement('a');
          link.download = `采购_${record.supplier}_${record.model}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        }
      } else {
        const link = document.createElement('a');
        link.download = `采购_${record.supplier}_${record.model}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }

      if (webhookUrl) {
        const dataUrl = canvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msgtype: "image", image: { base64: base64Data } })
        }).catch(err => console.error("Webhook push failed", err));
      }
      
    } catch (err) {
      console.error("Process failed", err);
    }
  };

  const addRecord = (record: ProcurementRecord) => {
    setRecords(prev => {
      const exists = prev.find(r => r.id === record.id);
      if (exists) {
        return prev.map(r => r.id === record.id ? record : r);
      }
      return [record, ...prev];
    });
    setEditingRecord(null);
    generateAndSendImage(record);
  };

  const deleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const startEdit = (record: ProcurementRecord) => {
    setEditingRecord(record);
    setActiveTab(AppTab.PROCURE);
  };

  const clearToday = () => {
    const todayStr = new Date().toDateString();
    setRecords(prev => prev.filter(r => new Date(r.timestamp).toDateString() !== todayStr));
  };

  const addPresetColor = () => {
    if (newColorInput && !presetColors.includes(newColorInput)) {
      setPresetColors([...presetColors, newColorInput]);
      setNewColorInput('');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.TODAY:
        return <TodayView records={records} onDelete={deleteRecord} onClear={clearToday} onEdit={startEdit} />;
      case AppTab.PROCURE:
        return (
          <ProcureView 
            onComplete={addRecord} 
            onCancel={() => {
              setEditingRecord(null);
              setActiveTab(AppTab.TODAY);
            }} 
            supplier={currentSupplier}
            onSupplierChange={setCurrentSupplier}
            presetColors={presetColors}
            editRecord={editingRecord || undefined}
          />
        );
      case AppTab.SUMMARY:
        return <SummaryView records={records} />;
      case AppTab.SETTINGS:
        return (
          <div className="p-8 flex flex-col items-start justify-start h-full text-zinc-500 bg-white overflow-y-auto pb-32">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center shadow-lg">
                <SettingsIcon size={24} className="text-white" />
              </div>
              <h2 className="text-2xl font-black text-zinc-900 tracking-tighter">应用设置</h2>
            </div>
            
            <section className="w-full space-y-4 mb-10">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-zinc-900" />
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">指定的微信群</h3>
                </div>
              </div>
              
              <div className="space-y-4 bg-zinc-50 p-5 rounded-xl border border-zinc-100">
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase mb-1.5 block px-1">私人微信群名称</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="例如: 采购一部" 
                      value={targetGroupName}
                      onChange={e => setTargetGroupName(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-sm font-bold outline-none focus:border-zinc-900 shadow-sm"
                    />
                    {targetGroupName && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(targetGroupName);
                          alert("已复制群名，方便在微信中搜索");
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-900"
                      >
                        <Clipboard size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase mb-1.5 block px-1">自动化推送 (可选 Webhook)</label>
                  <input 
                    type="text" 
                    placeholder="企业微信机器人 URL (如有)" 
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg text-xs font-medium outline-none focus:border-zinc-900 shadow-sm"
                  />
                </div>
                
                <p className="text-[10px] text-zinc-400 leading-relaxed italic px-1 pt-1">
                  * 录入采购后将自动触发系统分享面板。选择微信并发送至上述群组即可。
                </p>
              </div>
            </section>

            <section className="w-full space-y-4 mb-10 pt-4 border-t border-zinc-50">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">常用颜色库</h3>
              <div className="flex flex-wrap gap-2.5 mb-4">
                {presetColors.map(color => (
                  <div key={color} className="flex items-center gap-2 bg-zinc-50 border border-zinc-100 px-3 py-2 rounded-lg">
                    <span className="text-xs font-bold text-zinc-900">{color}</span>
                    <button onClick={() => setPresetColors(presetColors.filter(c => c !== color))} className="text-zinc-300 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 w-full">
                <input 
                  type="text" 
                  placeholder="新颜色..." 
                  value={newColorInput}
                  onChange={e => setNewColorInput(e.target.value)}
                  className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-lg text-sm font-bold outline-none focus:border-zinc-900"
                />
                <button onClick={addPresetColor} className="p-3 bg-zinc-900 text-white rounded-lg active:scale-95 shadow-lg">
                  <Plus size={20} />
                </button>
              </div>
            </section>

            <section className="w-full space-y-4 border-t border-zinc-50 pt-8">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">数据重置</h3>
              <button 
                onClick={() => {
                  if(confirm("确定要清空所有数据吗？此操作无法撤销。")) {
                    setRecords([]);
                    localStorage.removeItem('procurement_records');
                  }
                }}
                className="w-full py-4 bg-zinc-50 text-red-500 border border-red-50 rounded-lg font-black text-xs active:scale-95 transition-transform"
              >
                清空全库数据
              </button>
            </section>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden text-zinc-900">
      <header className="px-6 py-4 border-b bg-white sticky top-0 z-[110] flex justify-between items-center h-18">
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tighter text-zinc-900 leading-none">
            {activeTab === AppTab.PROCURE ? (editingRecord ? "修改采购" : "采购录入") : 
             activeTab === AppTab.TODAY ? "采购明细" : 
             activeTab === AppTab.SUMMARY ? "统计概览" : "系统设定"}
          </h1>
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Procurement v1.2</span>
        </div>
        
        {activeTab === AppTab.PROCURE && (
           <div className="flex flex-col items-end leading-tight bg-zinc-900 px-3 py-1.5 rounded-lg shadow-lg min-w-[80px] animate-in slide-in-from-right-4">
             <span className="text-[7px] font-black text-zinc-400 uppercase tracking-tighter">供应商</span>
             <span className="text-[11px] font-black text-white truncate max-w-[90px]">{currentSupplier || '待录入'}</span>
           </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto bg-white">
        {renderContent()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-zinc-100 flex justify-around py-3 px-2 z-[130] shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
        <NavItem active={activeTab === AppTab.PROCURE} onClick={() => setActiveTab(AppTab.PROCURE)} icon={<ShoppingBag size={20} />} label="采购" />
        <NavItem active={activeTab === AppTab.TODAY} onClick={() => setActiveTab(AppTab.TODAY)} icon={<ListOrdered size={20} />} label="明细" />
        <NavItem active={activeTab === AppTab.SUMMARY} onClick={() => setActiveTab(AppTab.SUMMARY)} icon={<BarChart3 size={20} />} label="汇总" />
        <NavItem active={activeTab === AppTab.SETTINGS} onClick={() => setActiveTab(AppTab.SETTINGS)} icon={<SettingsIcon size={20} />} label="设定" />
      </nav>
    </div>
  );
};

const NavItem: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'text-zinc-950 scale-105' : 'text-zinc-300'}`}>
    <div className={`p-1 transition-colors ${active ? 'bg-zinc-50 rounded-lg' : ''}`}> {icon} </div>
    <span className={`text-[9px] font-black tracking-tighter transition-opacity ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
  </button>
);

export default App;
