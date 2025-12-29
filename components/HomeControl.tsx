
import React, { useState, useEffect } from 'react';
import { Home, Lightbulb, Thermometer, Lock, Power, Plus, Trash2, Smartphone, Wifi, Bluetooth, Activity, Zap, ChevronRight, Settings } from 'lucide-react';
import { getRooms, getSmartDevices, updateSmartDevice, addSmartDevice, addRoom, deleteSmartDevice, getSettings } from '../services/storage';
import { SmartDevice, Room, ConnectionProtocol } from '../types';

const HomeControl: React.FC = () => {
  const [devices, setDevices] = useState<SmartDevice[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  
  // Form State
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<SmartDevice['type']>('light');
  const [newProtocol, setNewProtocol] = useState<ConnectionProtocol>('wifi');

  const settings = getSettings();

  useEffect(() => {
    refresh();
  }, []);

  const refresh = () => {
    setDevices(getSmartDevices());
    setRooms(getRooms());
  };

  const handleToggle = (id: string, currentStatus: string) => {
    let nextStatus: any = currentStatus === 'on' ? 'off' : 'on';
    if (currentStatus === 'locked') nextStatus = 'unlocked';
    if (currentStatus === 'unlocked') nextStatus = 'locked';
    
    updateSmartDevice(id, { status: nextStatus });
    refresh();
  };

  const handleAddDevice = () => {
    if (!newDeviceName.trim()) return;
    
    let targetRoomName = "Living Room";
    if (selectedRoomId !== 'all') {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (room) targetRoomName = room.name;
    }

    addSmartDevice({
      name: newDeviceName.trim(),
      type: newDeviceType,
      status: newDeviceType === 'lock' ? 'locked' : 'off',
      room: targetRoomName,
      protocol: newProtocol,
      powerUsage: 0,
      brightness: newDeviceType === 'light' ? 100 : undefined
    });

    setNewDeviceName('');
    setIsAddingDevice(false);
    refresh();
  };

  const filteredDevices = selectedRoomId === 'all' 
    ? devices 
    : devices.filter(d => {
        const room = rooms.find(r => r.id === selectedRoomId);
        return d.room === room?.name;
      });

  const totalPower = devices.reduce((acc, d) => acc + (d.powerUsage || 0), 0);

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8 h-full overflow-y-auto space-y-8 scrollbar-thin scrollbar-thumb-slate-700 pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Home className="text-indigo-400" /> Home Control
          </h2>
          <p className="text-slate-400 mt-1">Manage modular hardware nodes and wireless satellites.</p>
        </div>
        <div className="flex gap-3">
           <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl flex items-center gap-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Grid Load</span>
                <span className="text-sm font-mono text-white">{totalPower}W</span>
              </div>
           </div>
           <button 
             onClick={() => setIsAddingDevice(true)}
             className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
           >
             <Plus className="w-5 h-5" /> Add Node
           </button>
        </div>
      </header>

      {/* Room Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button 
          onClick={() => setSelectedRoomId('all')}
          className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all border whitespace-nowrap ${selectedRoomId === 'all' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}
        >
          All Nodes
        </button>
        {rooms.map(room => (
          <button 
            key={room.id}
            onClick={() => setSelectedRoomId(room.id)}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all border whitespace-nowrap ${selectedRoomId === room.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}
          >
            {room.name}
          </button>
        ))}
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredDevices.map(device => {
          const isActive = device.status === 'on' || device.status === 'unlocked' || device.status === 'active' || device.status === 'playing';
          return (
            <div key={device.id} className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-6 hover:border-slate-700 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl transition-all ${isActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-500'}`}>
                  {device.type === 'light' && <Lightbulb className="w-6 h-6" />}
                  {device.type === 'thermostat' && <Thermometer className="w-6 h-6" />}
                  {device.type === 'lock' && <Lock className="w-6 h-6" />}
                  {device.type === 'outlet' && <Power className="w-6 h-6" />}
                  {device.type === 'sensor' && <Activity className="w-6 h-6" />}
                </div>
                <button 
                  onClick={() => handleToggle(device.id, device.status)}
                  className={`w-14 h-8 rounded-full relative transition-colors ${isActive ? 'bg-indigo-600' : 'bg-slate-950'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${isActive ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-100 truncate">{device.name}</h3>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">{device.room}</p>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800/50 flex justify-between items-center">
                 <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    {device.protocol === 'wifi' ? <Wifi className="w-3 h-3 text-cyan-400" /> : <Bluetooth className="w-3 h-3 text-indigo-400" />}
                    {device.protocol}
                 </div>
                 {device.powerUsage !== undefined && (
                   <div className="text-xs font-mono text-slate-400">{device.powerUsage}W</div>
                 )}
                 {device.battery !== undefined && (
                   <div className={`text-[10px] font-bold ${device.battery < 20 ? 'text-red-400' : 'text-emerald-400'}`}>{device.battery}% Bat</div>
                 )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Device Modal */}
      {isAddingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddingDevice(false)}></div>
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 w-full max-w-md relative z-10 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-bold text-white mb-6">New Modular Node</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Node Designation</label>
                <input 
                  type="text" 
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Balcony Light"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Protocol</label>
                  <select 
                    value={newProtocol}
                    onChange={(e) => setNewProtocol(e.target.value as ConnectionProtocol)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white outline-none"
                  >
                    <option value="wifi">Wi-Fi</option>
                    <option value="ble">Bluetooth</option>
                    <option value="wired">Wired</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Class</label>
                  <select 
                    value={newDeviceType}
                    onChange={(e) => setNewDeviceType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white outline-none"
                  >
                    <option value="light">Light</option>
                    <option value="lock">Lock</option>
                    <option value="outlet">Outlet</option>
                    <option value="sensor">Sensor</option>
                    <option value="thermostat">Thermostat</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={handleAddDevice}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20"
              >
                Deploy Node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeControl;
