
import React, { useState } from 'react';
import { BrainCircuit, ChevronRight, User, Briefcase, Heart, Sparkles, Database, Check, Loader2 } from 'lucide-react';
import { saveUserProfile, addMemory, updatePerson, saveSettings, getSettings } from '../services/storage';
import { UserProfile, MemoryType } from '../types';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserProfile>({
    name: '',
    role: '',
    interests: [],
    bio: '',
    onboardingComplete: false
  });
  const [tempInterest, setTempInterest] = useState('');

  const handleNext = () => {
    if (step === 2 && tempInterest.trim()) {
        handleAddInterest();
    }
    if (step < 3) setStep(step + 1);
  };

  const handleAddInterest = () => {
    if (tempInterest.trim()) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, tempInterest.trim()]
      }));
      setTempInterest('');
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    
    setTimeout(() => {
        const finalProfile = { ...formData, onboardingComplete: true };
        saveUserProfile(finalProfile);
        updatePerson(finalProfile.name, `Role: ${finalProfile.role}`, "Self");
        
        // Seed initial memories following Schema 3.2
        if (finalProfile.bio) {
             addMemory({
               content: finalProfile.bio,
               domain: 'personal',
               type: 'raw',
               entity: finalProfile.name,
               speaker: 'user',
               recall_priority: 'high'
             });
             addMemory({
               content: `User is a ${finalProfile.role}`,
               domain: 'personal',
               type: 'fact',
               entity: 'identity',
               speaker: 'user',
               recall_priority: 'high'
             });
        }

        finalProfile.interests.forEach(interest => {
            const catName = interest.charAt(0).toUpperCase() + interest.slice(1);
            addMemory({
              content: `Initial satellite node established for ${interest}.`,
              domain: 'general',
              type: 'raw',
              entity: catName,
              speaker: 'user',
              recall_priority: 'normal'
            });
        });

        const settings = getSettings();
        if (!settings.ollamaUrl && !process.env.API_KEY) {
            saveSettings({ ...settings, enableSimulation: true });
        }

        setLoading(false);
        onComplete();
    }, 2000);
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden bg-slate-950">
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 z-0"></div>
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[100px] rounded-full z-0"></div>

       <div className="relative z-10 max-w-lg w-full flex flex-col max-h-full">
         <div className="flex justify-between items-center mb-8 px-4 shrink-0">
             {[1, 2, 3].map(i => (
                 <div key={i} className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                        step >= i ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50' : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}>
                        {step > i ? <Check className="w-4 h-4" /> : i}
                    </div>
                    {i < 3 && <div className={`w-12 h-1 rounded-full transition-all duration-500 ${step > i ? 'bg-indigo-600' : 'bg-slate-800'}`}></div>}
                 </div>
             ))}
         </div>

         <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-2xl relative flex flex-col overflow-y-auto max-h-[80vh]">
            {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-400">
                            <User className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-100">Identity Verification</h2>
                        <p className="text-slate-400">Establish root user node.</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Designation (Name)</label>
                            <input 
                              type="text" 
                              value={formData.name}
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              className="w-full bg-slate-800 border-slate-700 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                              placeholder="e.g. Alex"
                              autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Functional Role</label>
                            <input 
                              type="text" 
                              value={formData.role}
                              onChange={(e) => setFormData({...formData, role: e.target.value})}
                              className="w-full bg-slate-800 border-slate-700 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                              placeholder="e.g. Software Architect, Artist, Student"
                            />
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-pink-400">
                            <Briefcase className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-100">Core Directives</h2>
                        <p className="text-slate-400">Define satellite clusters.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Key Interests</label>
                        <div className="flex gap-2 mb-3">
                            <input 
                              type="text" 
                              value={tempInterest}
                              onChange={(e) => setTempInterest(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddInterest()}
                              className="flex-1 bg-slate-800 border-slate-700 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-pink-500 outline-none"
                              placeholder="e.g. AI, Hiking, Jazz..."
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 min-h-[60px]">
                            {formData.interests.map((int, i) => (
                                <span key={i} className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-sm border border-pink-500/30 flex items-center gap-2">
                                    {int}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-cyan-400">
                            <Sparkles className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-100">Genesis</h2>
                        <p className="text-slate-400">Initialize neural pathways.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">User Manifesto (Optional)</label>
                        <textarea 
                          value={formData.bio}
                          onChange={(e) => setFormData({...formData, bio: e.target.value})}
                          className="w-full bg-slate-800 border-slate-700 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-cyan-500 outline-none h-32 resize-none"
                          placeholder="What should Jarvis know about your values?"
                        />
                    </div>
                </div>
            )}

            <div className="pt-8 flex justify-end mt-auto sticky bottom-0 bg-transparent">
                {step < 3 ? (
                    <button 
                      onClick={handleNext}
                      disabled={step === 1 && !formData.name}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                    >
                        Next Phase <ChevronRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button 
                      onClick={handleFinish}
                      disabled={loading}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                        Initialize System
                    </button>
                )}
            </div>
         </div>
       </div>
    </div>
  );
};

export default Onboarding;
