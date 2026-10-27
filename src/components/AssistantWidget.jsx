import React, { useState } from 'react';
import { ASSISTANT_PROMPTS, answerAssistantQuery } from '../../shared/assistant.js';

export default function AssistantWidget({ role, lang, org, worker, workers, shifts, reports, t }) {
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: lang === 'ta'
        ? `வணக்கம்! நான் ஃபேர்ஷிஃப்ட் வழிகாட்டி. உங்கள் உண்மையான பணி நேரம், சம்பளம், சோர்வு விதிகள் அல்லது பாதுகாப்பு புகார்கள் குறித்த சந்தேகங்களைத் தெளிவுபடுத்த நான் உதவ முடியும்.`
        : `Hello! I am your FairShift Context Assistant. I provide deterministic explanations grounded in your actual recorded shifts, pay rates, fatigue rules, and safety reports. Select a suggested topic or ask a question below.`,
      note: t.groundedNotice
    }
  ]);
  const [customInput, setCustomInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* Header bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 flex justify-between items-center cursor-pointer select-none"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-base shadow">
            💡
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-sm tracking-tight">{t.assistantTitle}</h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-200 border border-indigo-700">
                {role === 'worker' ? t.assistantRoleWorker : t.assistantRoleEmployer}
              </span>
            </div>
            <p className="text-xs text-slate-300">{t.assistantSubtitle}</p>
          </div>
        </div>
        <button 
          aria-label={isExpanded ? 'Collapse Assistant' : 'Expand Assistant'} 
          className="text-slate-400 hover:text-white text-lg font-bold px-2 cursor-pointer"
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Quick Prompts (especially beneficial for low-literacy frontline workers) */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              {t.suggestedQuestions}
            </div>
            <div className="flex flex-wrap gap-2">
              {prompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleQuery(p.text, p.id)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-medium px-3 py-1.5 rounded-lg border border-slate-200 transition text-left cursor-pointer"
                >
                  {p.text}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Stream */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-72 overflow-y-auto space-y-3">
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
              placeholder={t.askCustomPlaceholder}
              className="flex-1 text-xs sm:text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-emerald-500 bg-white"
            />
            <button
              type="submit"
              disabled={!customInput.trim()}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer"
            >
              {t.sendQuestion}
            </button>
          </form>

          {/* Grounding notice */}
          <div className="text-[11px] text-slate-400 bg-slate-100/70 p-2 rounded-lg flex items-center space-x-1.5">
            <span className="text-emerald-600 font-bold">🔒</span>
            <span>{t.groundedNotice}</span>
          </div>
        </div>
      )}
    </div>
  );
}
