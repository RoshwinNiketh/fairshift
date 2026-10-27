import React, { useState, useEffect } from 'react';
import { ASSISTANT_PROMPTS, answerAssistantQuery } from '../../shared/assistant.js';

export default function AssistantWidget({ role, lang, org, worker, workers, shifts, reports, t }) {
  // P0 Fix: Context isolation key triggers state reset when worker, org, role, or language changes
  const contextKey = `${role}_${lang}_${org?.id || ''}_${worker?.id || ''}`;

  const [messages, setMessages] = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Initialize or isolate conversation history whenever the context key changes
  useEffect(() => {
    const welcomeText = lang === 'ta'
      ? role === 'worker'
        ? `வணக்கம் ${worker?.name || ''}! நான் ஃபேர்ஷிஃப்ட் தொழிலாளர் வழிகாட்டி. உங்கள் பணி நேரம், சம்பளம், சோர்வு எச்சரிக்கை அல்லது பாதுகாப்பு புகார்கள் குறித்த தெளிவான விளக்கங்களை கீழே தேர்ந்தெடுக்கலாம்.`
        : `வணக்கம் நிர்வாக மேற்பார்வையாளர்! நான் ${org?.name || ''} செயல்பாட்டு வழிகாட்டி. பணியாளர் சோர்வு எச்சரிக்கைகள், திறந்திருக்கும் தீவிர புகார்கள் மற்றும் வேலை நேர சுருக்கங்களை நான் வழங்க முடியும்.`
      : role === 'worker'
        ? `Hello ${worker?.name || ''}! I am your FairShift Worker Advisor. I provide grounded explanations regarding your recorded shifts, pay rate (${org?.symbol || '₹'}${worker?.hourlyRate || 0}/hr), rest rules, and submitted safety reports.`
        : `Welcome Supervisor. I am the Operations Advisor for ${org?.name || 'this organization'}. I can summarize active fatigue alerts, open high-severity hazards, and aggregate duty hours.`;

    setMessages([
      {
        sender: 'assistant',
        text: welcomeText,
        note: t.groundedNotice
      }
    ]);
    setCustomInput('');
  }, [contextKey]);

  const prompts = (ASSISTANT_PROMPTS[lang] || ASSISTANT_PROMPTS.en)[role] || [];

  const handleQuery = (queryText, queryId = null) => {
    if (!queryText.trim()) return;

    const userMessage = { sender: 'user', text: queryText };
    const queryKey = queryId || queryText;

    const context = {
      role,
      lang,
      org,
      worker,
      workers,
      shifts,
      reports
    };

    const response = answerAssistantQuery(queryKey, context);

    setMessages(prev => [
      ...prev,
      userMessage,
      {
        sender: 'assistant',
        text: response.answer,
        note: response.note
      }
    ]);
    setCustomInput('');
  };

  return (
    <section 
      aria-label={t.assistantTitle}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6"
    >
      {/* Semantic Accessible Header bar */}
      <button 
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="assistant-panel-content"
        className="w-full text-left bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 flex justify-between items-center cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-base shadow" aria-hidden="true">
            💡
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-sm tracking-tight">{t.assistantTitle}</h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-900/90 text-indigo-200 border border-indigo-700">
                {role === 'worker' ? t.assistantRoleWorker : t.assistantRoleEmployer}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">{t.assistantSubtitle}</p>
          </div>
        </div>
        <div className="text-slate-300 hover:text-white text-xs font-semibold px-2 py-1 rounded bg-slate-800/60 border border-slate-700">
          {isExpanded ? (lang === 'ta' ? 'மறைக்க ▲' : 'Collapse ▲') : (lang === 'ta' ? 'காட்டுக ▼' : 'Expand ▼')}
        </div>
      </button>

      {isExpanded && (
        <div id="assistant-panel-content" className="p-4 sm:p-5 space-y-4">
          {/* Quick Prompts (especially beneficial for low-literacy frontline workers) */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              {t.suggestedQuestions}
            </div>
            <div className="flex flex-wrap gap-2">
              {prompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleQuery(p.text, p.id)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-medium px-3 py-2 rounded-xl border border-slate-200 transition text-left cursor-pointer min-h-[38px] focus-visible:outline-2 focus-visible:outline-emerald-500"
                >
                  {p.text}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Stream */}
          <div 
            role="log" 
            aria-live="polite" 
            className="bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-72 overflow-y-auto space-y-3"
          >
            {messages.map((m, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`max-w-[85%] text-xs sm:text-sm rounded-2xl p-3 leading-relaxed whitespace-pre-wrap ${
                    m.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none shadow-sm'
                      : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  {m.text}
                </div>
                {m.note && (
                  <span className="text-[10px] text-slate-400 mt-1 px-1 italic">
                    {m.note}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Custom Input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleQuery(customInput);
            }} 
            className="flex gap-2"
          >
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              aria-label={t.askCustomPlaceholder}
              placeholder={t.askCustomPlaceholder}
              className="flex-1 text-xs sm:text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 bg-white"
            />
            <button
              type="submit"
              disabled={!customInput.trim()}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer min-h-[42px]"
            >
              {t.sendQuestion}
            </button>
          </form>

          {/* Grounding notice */}
          <div className="text-[11px] text-slate-500 bg-slate-100/80 p-2.5 rounded-xl flex items-center space-x-2">
            <span className="text-emerald-600 font-bold" aria-hidden="true">🔒</span>
            <span>{t.groundedNotice}</span>
          </div>
        </div>
      )}
    </section>
  );
}
